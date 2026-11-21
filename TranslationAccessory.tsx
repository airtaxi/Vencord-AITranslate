/*
 * AITranslate, a Vencord plugin
 * Copyright (c) 2026 Howon Lee
 * SPDX-License-Identifier: MIT
 */

import { classNameFactory } from "@utils/css";
import { useForceUpdater } from "@utils/react";
import { Message } from "@vencord/discord-types";
import { Parser, SelectedChannelStore, useEffect } from "@webpack/common";

import { settings } from "./settings";
import { getMessageText, getTranslation, requestTranslation, shouldAutoTranslate, subscribeTranslation } from "./translator";

export const cl = classNameFactory("vc-ait-");

function TranslateIcon() {
    return (
        <svg className={cl("icon")} viewBox="0 96 960 960" width={16} height={16} aria-hidden="true">
            <path fill="currentColor" d="m475 976 181-480h82l186 480h-87l-41-126H604l-47 126h-82Zm151-196h142l-70-194h-2l-70 194Zm-466 76-55-55 204-204q-38-44-67.5-88.5T190 416h87q17 33 37.5 62.5T361 539q45-47 75-97.5T487 336H40v-80h280v-80h80v80h280v80H567q-22 69-58.5 135.5T419 598l98 99-30 81-127-122-200 200Z" />
        </svg>
    );
}

export function TranslationAccessory({ message }: { message: Message; }) {
    const forceUpdate = useForceUpdater();
    const { guildIds, autoTranslateWindowHours, requireLatinLetters } = settings.use(["guildIds", "autoTranslateWindowHours", "requireLatinLetters"]);
    const isEmbedded = Boolean((message as any).vencordEmbeddedBy);
    const text = getMessageText(message);

    useEffect(() => subscribeTranslation(message.id, forceUpdate), [message.id]);

    useEffect(() => {
        if (isEmbedded) return;
        if (shouldAutoTranslate(message) || getTranslation(message.id))
            requestTranslation(message);
    }, [message.id, text, guildIds, autoTranslateWindowHours, requireLatinLetters]);

    const entry = getTranslation(message.id);
    if (isEmbedded || !entry) return null;

    switch (entry.status) {
        case "pending":
            return (
                <div className={cl("accessory", "status")}>
                    <TranslateIcon />
                    <span>번역 중...</span>
                </div>
            );
        case "error":
            return (
                <div className={cl("accessory", "status")}>
                    <TranslateIcon />
                    <span>
                        번역하지 못했습니다. {entry.error}
                        <button className={cl("retry")} onClick={() => requestTranslation(message, true)}>
                            다시 시도
                        </button>
                    </span>
                </div>
            );
        case "done":
            return (
                <div className={cl("accessory")}>
                    <TranslateIcon />
                    <div className={cl("text")}>
                        {Parser.parse(entry.text!, true, {
                            channelId: message.channel_id,
                            messageId: message.id,
                            allowLinks: true,
                            allowHeading: true,
                            allowList: true,
                            allowEmojiLinks: true,
                            viewingChannelId: SelectedChannelStore.getChannelId()
                        })}
                    </div>
                </div>
            );
        default:
            return null;
    }
}
