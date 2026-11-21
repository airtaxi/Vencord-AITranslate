/*
 * AITranslate, a Vencord plugin
 * Copyright (c) 2026 Howon Lee
 * SPDX-License-Identifier: MIT
 */

import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { Guild, Message } from "@vencord/discord-types";
import { Menu } from "@webpack/common";

import { isGuildEnabled, setGuildEnabled, settings } from "./settings";
import { TranslationAccessory } from "./TranslationAccessory";
import { clearTranslations, getMessageText, getTranslation, hideTranslation, requestTranslation } from "./translator";

const messageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }: { message?: Message; }) => {
    if (!message || !getMessageText(message).trim()) return;

    const entry = getTranslation(message.id);
    const isShown = entry?.status === "done" || entry?.status === "pending";

    const items = isShown
        ? [
            <Menu.MenuItem
                key="vc-ait-retranslate"
                id="vc-ait-retranslate"
                label="AI 번역 다시 하기"
                action={() => requestTranslation(message, true)}
            />,
            <Menu.MenuItem
                key="vc-ait-hide"
                id="vc-ait-hide"
                label="AI 번역 숨기기"
                action={() => hideTranslation(message.id)}
            />
        ]
        : [
            <Menu.MenuItem
                key="vc-ait-translate"
                id="vc-ait-translate"
                label="AI로 번역"
                action={() => requestTranslation(message, true)}
            />
        ];

    const group = findGroupChildrenByChildId("copy-text", children) ?? children;
    const copyIndex = group.findIndex(child => child?.props?.id === "copy-text");

    if (copyIndex === -1) group.push(...items);
    else group.splice(copyIndex + 1, 0, ...items);
};

const guildContextMenuPatch: NavContextMenuPatchCallback = (children, { guild }: { guild?: Guild; }) => {
    if (!guild) return;

    const enabled = isGuildEnabled(guild.id);
    const group = findGroupChildrenByChildId("privacy", children) ?? children;

    group.push(
        <Menu.MenuItem
            id="vc-ait-toggle-guild"
            label={enabled ? "AI 자동 번역 끄기" : "AI 자동 번역 켜기"}
            action={() => setGuildEnabled(guild.id, !enabled)}
        />
    );
};

export default definePlugin({
    name: "AITranslate",
    description: "지정한 서버의 메시지를 OpenAI 호환 API로 번역해서 메시지 아래에 표시합니다.",
    tags: ["Chat", "Utility"],
    authors: [{ name: "Howon Lee", id: 0n }],
    settings,

    contextMenus: {
        "message": messageContextMenuPatch,
        "guild-context": guildContextMenuPatch
    },

    renderMessageAccessory: props =>
        !props.isMessageSnapshot
            ? <TranslationAccessory message={props.message} />
            : null,

    stop() {
        clearTranslations();
    }
});
