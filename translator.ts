/*
 * AITranslate, a Vencord plugin
 * Copyright (c) 2026 Howon Lee
 * SPDX-License-Identifier: MIT
 */

import { Logger } from "@utils/Logger";
import { PluginNative } from "@utils/types";
import { Message } from "@vencord/discord-types";
import { ChannelStore, GuildMemberStore, MessageStore, UserStore } from "@webpack/common";

import { isGuildEnabled, REASONING_EFFORT_UNSET, settings } from "./settings";

const Native = VencordNative.pluginHelpers.AITranslate as PluginNative<typeof import("./native")>;
const logger = new Logger("AITranslate");

const NO_TRANSLATION_MARKER = "[[NO_TRANSLATION]]";
const MAX_CONCURRENT_REQUESTS = 3;
const MAX_CACHED_ENTRIES = 2000;
const MAX_CONTEXT_MESSAGE_LENGTH = 600;
const WEB_REQUEST_TIMEOUT_MS = 120_000;
const DISCORD_EPOCH = 1420070400000n;

const NON_TEXT_PATTERNS = [
    /```[\s\S]*?```/g,
    /`[^`\n]*`/g,
    /<a?:\w+:\d+>/g,
    /<(?:@[!&]?|#)\d+>/g,
    /<\/[^:>]+:\d+>/g,
    /<t:-?\d+(?::\w)?>/g,
    /https?:\/\/\S+/g
];

export type TranslationStatus = "pending" | "done" | "skipped" | "error" | "hidden";

export interface TranslationEntry {
    status: TranslationStatus;
    source: string;
    text?: string;
    error?: string;
}

const entries = new Map<string, TranslationEntry>();
const listeners = new Map<string, Set<() => void>>();
const queue: (() => Promise<void>)[] = [];
let activeRequests = 0;

export function getTranslation(messageId: string) {
    return entries.get(messageId);
}

export function subscribeTranslation(messageId: string, listener: () => void) {
    let messageListeners = listeners.get(messageId);
    if (!messageListeners) {
        messageListeners = new Set();
        listeners.set(messageId, messageListeners);
    }

    messageListeners.add(listener);

    return () => {
        messageListeners.delete(listener);
        if (!messageListeners.size) listeners.delete(messageId);
    };
}

function setEntry(messageId: string, entry: TranslationEntry) {
    entries.delete(messageId);
    entries.set(messageId, entry);

    if (entries.size > MAX_CACHED_ENTRIES) {
        const oldestId = entries.keys().next().value;
        if (oldestId) entries.delete(oldestId);
    }

    listeners.get(messageId)?.forEach(listener => listener());
}

export function clearTranslations() {
    queue.length = 0;
    const messageIds = [...entries.keys()];
    entries.clear();
    for (const messageId of messageIds)
        listeners.get(messageId)?.forEach(listener => listener());
}

export function getMessageText(message: Message) {
    return message.content || message.messageSnapshots?.[0]?.message.content || "";
}

function getSnowflakeTimestamp(id: string) {
    try {
        return Number((BigInt(id) >> 22n) + DISCORD_EPOCH);
    } catch {
        return 0;
    }
}

function isOlderSnowflake(id: string, otherId: string) {
    return id.length !== otherId.length ? id.length < otherId.length : id < otherId;
}

function hasTranslatableText(text: string) {
    const stripped = NON_TEXT_PATTERNS.reduce((result, pattern) => result.replace(pattern, " "), text);
    return settings.store.requireLatinLetters
        ? /[a-z]/i.test(stripped)
        : /\p{L}/u.test(stripped);
}

export function shouldAutoTranslate(message: Message) {
    if (!message?.id || !message.author) return false;
    if (message.author.id === UserStore.getCurrentUser()?.id) return false;

    const guildId = ChannelStore.getChannel(message.channel_id)?.guild_id;
    if (!isGuildEnabled(guildId)) return false;

    const windowHours = Number(settings.store.autoTranslateWindowHours);
    if (windowHours > 0 && Date.now() - getSnowflakeTimestamp(message.id) > windowHours * 3_600_000)
        return false;

    return hasTranslatableText(getMessageText(message));
}

export function requestTranslation(message: Message, force = false) {
    const source = getMessageText(message);
    if (!source.trim()) return;

    const current = entries.get(message.id);
    if (!force && current && (current.status === "hidden" || current.source === source)) return;

    const entry: TranslationEntry = { status: "pending", source };
    setEntry(message.id, entry);

    enqueue(async () => {
        if (entries.get(message.id) !== entry) return;

        try {
            const text = await translateMessage(message, source);
            if (entries.get(message.id) !== entry) return;

            setEntry(message.id, text == null
                ? { status: "skipped", source }
                : { status: "done", source, text });
        } catch (e) {
            if (entries.get(message.id) !== entry) return;

            logger.error("Failed to translate message", message.id, e);
            setEntry(message.id, {
                status: "error",
                source,
                error: e instanceof Error ? e.message : String(e)
            });
        }
    });
}

export function hideTranslation(messageId: string) {
    setEntry(messageId, { status: "hidden", source: entries.get(messageId)?.source ?? "" });
}

function enqueue(task: () => Promise<void>) {
    queue.push(task);
    pumpQueue();
}

function pumpQueue() {
    while (activeRequests < MAX_CONCURRENT_REQUESTS && queue.length) {
        const task = queue.pop()!;
        activeRequests++;
        task().finally(() => {
            activeRequests--;
            pumpQueue();
        });
    }
}

function getDisplayName(message: Message, guildId: string | undefined) {
    const { author } = message;
    return (guildId && GuildMemberStore.getNick(guildId, author.id)) || author.globalName || author.username;
}

function getUserName(userId: string, guildId: string | undefined) {
    const user = UserStore.getUser(userId);
    return (guildId && GuildMemberStore.getNick(guildId, userId)) || user?.globalName || user?.username || "unknown";
}

function toReadableText(text: string, guildId: string | undefined) {
    const readable = text
        .replace(/<@!?(\d+)>/g, (_, id: string) => `@${getUserName(id, guildId)}`)
        .replace(/<#(\d+)>/g, (_, id: string) => `#${ChannelStore.getChannel(id)?.name ?? "channel"}`)
        .replace(/<a?:(\w+):\d+>/g, ":$1:")
        .replace(/\s*\n\s*/g, " ")
        .trim();

    return readable.length > MAX_CONTEXT_MESSAGE_LENGTH
        ? readable.slice(0, MAX_CONTEXT_MESSAGE_LENGTH) + "..."
        : readable;
}

function getContextMessages(message: Message, limit: number) {
    if (limit <= 0) return [];

    const loaded = MessageStore.getMessages(message.channel_id)?._array ?? [];
    return loaded
        .filter(m => m.author && isOlderSnowflake(m.id, message.id) && getMessageText(m).trim())
        .slice(-limit);
}

function getReferencedMessage(message: Message) {
    const reference = message.messageReference;
    if (!reference?.message_id) return undefined;
    return MessageStore.getMessage(reference.channel_id ?? message.channel_id, reference.message_id);
}

function buildRequestMessages(message: Message, source: string) {
    const guildId = ChannelStore.getChannel(message.channel_id)?.guild_id;
    const language = settings.store.targetLanguage.trim() || "Korean";
    const customInstructions = settings.store.customInstructions.trim();

    const systemLines = [
        `You translate Discord chat messages into ${language}.`,
        "Reply with only the translation of the text inside <message>. Do not add quotes, notes, romanization, or explanations.",
        "Keep Discord markdown, line breaks, mentions such as <@123>, <#123>, and <@&123>, custom emoji such as <:name:123>, timestamps such as <t:123>, URLs, and code blocks exactly as they are.",
        "Match the tone of the original. Casual chat stays casual, and slang or abbreviations become natural equivalents rather than literal translations.",
        "Use <context> and <reply_to> only to understand references, abbreviations, and who is talking to whom. Never translate them.",
        `If the text inside <message> is already written in ${language}, or contains nothing that needs translation, reply with exactly ${NO_TRANSLATION_MARKER}.`
    ];

    if (customInstructions)
        systemLines.push("", "Additional instructions:", customInstructions);

    const userLines: string[] = [];

    const context = getContextMessages(message, Math.round(settings.store.contextMessages));
    if (context.length) {
        userLines.push("<context>");
        for (const contextMessage of context)
            userLines.push(`${getDisplayName(contextMessage, guildId)}: ${toReadableText(getMessageText(contextMessage), guildId)}`);
        userLines.push("</context>", "");
    }

    const referenced = getReferencedMessage(message);
    if (referenced?.author) {
        userLines.push(
            "<reply_to>",
            `${getDisplayName(referenced, guildId)}: ${toReadableText(getMessageText(referenced), guildId)}`,
            "</reply_to>",
            ""
        );
    }

    userLines.push(
        `<message author="${getDisplayName(message, guildId).replace(/"/g, "'")}">`,
        source,
        "</message>"
    );

    return [
        { role: "system", content: systemLines.join("\n") },
        { role: "user", content: userLines.join("\n") }
    ];
}

function getChatCompletionsUrl(endpoint: string) {
    const trimmed = endpoint.trim().replace(/\/+$/, "");
    return /\/chat\/completions$/i.test(trimmed) ? trimmed : `${trimmed}/chat/completions`;
}

function describeError(status: number, data: string) {
    if (status === -1) return `API 서버에 연결하지 못했습니다. (${data})`;

    let detail = data.slice(0, 300);
    try {
        detail = JSON.parse(data)?.error?.message ?? detail;
    } catch { }

    switch (status) {
        case 401:
        case 403:
            return `API 키를 확인해 주세요. (${status}: ${detail})`;
        case 404:
            return `엔드포인트 주소나 모델 이름을 확인해 주세요. (${status}: ${detail})`;
        case 429:
            return `요청 한도를 넘었습니다. 잠시 후 다시 시도해 주세요. (${detail})`;
        default:
            return `${status}: ${detail}`;
    }
}

async function postChatCompletion(url: string, apiKey: string, body: string): Promise<{ status: number; data: string; }> {
    if (!IS_WEB) return Native.requestChatCompletion(url, apiKey, body);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const vencordMobile = (window as any).VencordMobile;
    if (typeof vencordMobile?.nativeFetch === "function")
        return vencordMobile.nativeFetch(url, { method: "POST", headers, body });

    try {
        const res = await fetch(url, {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(WEB_REQUEST_TIMEOUT_MS)
        });

        return { status: res.status, data: await res.text() };
    } catch (e) {
        return { status: -1, data: String(e) };
    }
}

function readCompletionText(data: string) {
    const content = JSON.parse(data)?.choices?.[0]?.message?.content;

    if (typeof content === "string") return content;
    if (Array.isArray(content))
        return content.map(part => typeof part === "string" ? part : part?.text ?? "").join("");

    return "";
}

async function translateMessage(message: Message, source: string): Promise<string | null> {
    const { endpoint, apiKey, model, reasoningEffort } = settings.store;

    if (!endpoint.trim()) throw new Error("API 엔드포인트를 설정해 주세요.");
    if (!model.trim()) throw new Error("모델 이름을 설정해 주세요.");

    const body: Record<string, unknown> = {
        model: model.trim(),
        messages: buildRequestMessages(message, source)
    };

    if (reasoningEffort && reasoningEffort !== REASONING_EFFORT_UNSET)
        body.reasoning_effort = reasoningEffort;

    const { status, data } = await postChatCompletion(
        getChatCompletionsUrl(endpoint),
        apiKey.trim(),
        JSON.stringify(body)
    );

    if (status < 200 || status >= 300) throw new Error(describeError(status, data));

    let text: string;
    try {
        text = readCompletionText(data).trim();
    } catch {
        throw new Error("API 응답을 해석하지 못했습니다.");
    }

    if (!text) throw new Error("모델이 빈 응답을 보냈습니다.");
    if (text.includes(NO_TRANSLATION_MARKER) || text === source.trim()) return null;

    return text;
}
