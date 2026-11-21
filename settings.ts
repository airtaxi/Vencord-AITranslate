/*
 * AITranslate, a Vencord plugin
 * Copyright (c) 2026 Howon Lee
 * SPDX-License-Identifier: MIT
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const REASONING_EFFORT_UNSET = "unset";

export const settings = definePluginSettings({
    guildIds: {
        type: OptionType.STRING,
        displayName: "자동 번역 서버",
        description: "자동 번역할 서버 ID 목록입니다. 쉼표나 줄바꿈으로 구분하며, 서버 아이콘 우클릭 메뉴에서도 추가하거나 뺄 수 있습니다.",
        default: "",
        multiline: true
    },
    endpoint: {
        type: OptionType.STRING,
        displayName: "API 엔드포인트",
        description: "OpenAI 호환 API 주소입니다. 주소가 /chat/completions로 끝나지 않으면 뒤에 붙여서 요청합니다.",
        default: "https://api.openai.com/v1",
        placeholder: "https://api.openai.com/v1"
    },
    apiKey: {
        type: OptionType.STRING,
        displayName: "API 키",
        description: "Authorization 헤더로 보낼 API 키입니다. 키가 필요 없는 로컬 서버라면 비워 둡니다.",
        default: ""
    },
    model: {
        type: OptionType.STRING,
        displayName: "모델",
        description: "번역에 사용할 모델 이름입니다.",
        default: "gpt-5-mini",
        placeholder: "gpt-5-mini"
    },
    reasoningEffort: {
        type: OptionType.SELECT,
        displayName: "추론 강도",
        description: "추론 모델에 보낼 reasoning_effort 값입니다. '보내지 않음'을 고르면 요청에 넣지 않으므로 모델 기본값이 적용됩니다.",
        options: [
            { label: "보내지 않음", value: REASONING_EFFORT_UNSET, default: true },
            { label: "none", value: "none" },
            { label: "minimal", value: "minimal" },
            { label: "low", value: "low" },
            { label: "medium", value: "medium" },
            { label: "high", value: "high" },
            { label: "xhigh", value: "xhigh" }
        ]
    },
    targetLanguage: {
        type: OptionType.STRING,
        displayName: "번역 언어",
        description: "번역 결과로 받을 언어입니다.",
        default: "Korean",
        placeholder: "Korean"
    },
    contextMessages: {
        type: OptionType.SLIDER,
        displayName: "이전 메시지 수",
        description: "번역할 메시지와 함께 문맥으로 보낼 이전 메시지 수입니다. 많을수록 문맥을 잘 반영하지만 요청 비용이 늘어납니다.",
        markers: [0, 5, 10, 15, 20, 30],
        default: 10,
        stickToMarkers: true
    },
    autoTranslateWindowHours: {
        type: OptionType.SELECT,
        displayName: "자동 번역 기간",
        description: "이 기간 안에 올라온 메시지만 화면에 표시될 때 자동으로 번역합니다. 기간이 길수록 채널을 열 때 한꺼번에 보내는 요청이 많아집니다. 더 오래된 메시지는 메시지 우클릭 메뉴에서 번역할 수 있습니다.",
        options: [
            { label: "1시간", value: 1 },
            { label: "6시간", value: 6 },
            { label: "24시간", value: 24, default: true },
            { label: "7일", value: 168 },
            { label: "제한 없음", value: 0 }
        ]
    },
    requireLatinLetters: {
        type: OptionType.BOOLEAN,
        displayName: "알파벳이 있는 메시지만 번역",
        description: "알파벳(A-Z)이 하나도 없는 메시지는 번역을 요청하지 않습니다. 한국어로만 쓴 메시지에 불필요한 요청을 보내지 않게 됩니다.",
        default: true
    },
    customInstructions: {
        type: OptionType.STRING,
        displayName: "추가 지시 사항",
        description: "번역할 때 모델이 추가로 따를 지시 사항입니다. 예: 게임 용어는 영어 그대로 둘 것",
        default: "",
        multiline: true
    }
});

function parseIds(value: string) {
    return value.split(/[\s,]+/).filter(Boolean);
}

export function isGuildEnabled(guildId: string | null | undefined) {
    return guildId != null && parseIds(settings.store.guildIds).includes(guildId);
}

export function setGuildEnabled(guildId: string, enabled: boolean) {
    const ids = parseIds(settings.store.guildIds).filter(id => id !== guildId);
    if (enabled) ids.push(guildId);
    settings.store.guildIds = ids.join(", ");
}
