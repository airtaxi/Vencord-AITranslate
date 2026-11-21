/*
 * AITranslate, a Vencord plugin
 * Copyright (c) 2026 Howon Lee
 * SPDX-License-Identifier: MIT
 */

import { IpcMainInvokeEvent } from "electron";

const REQUEST_TIMEOUT_MS = 120_000;

export async function requestChatCompletion(_: IpcMainInvokeEvent, url: string, apiKey: string, body: string) {
    if (!/^https?:\/\//i.test(url))
        return { status: -1, data: `Invalid endpoint URL: ${url}` };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });

        return { status: res.status, data: await res.text() };
    } catch (e) {
        return { status: -1, data: String(e) };
    }
}
