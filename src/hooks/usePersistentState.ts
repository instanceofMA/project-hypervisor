"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Declarative hook for synchronizing state with localStorage using useSyncExternalStore.
 * Safe for SSR, avoids hydration mismatches, and reacts across window events.
 */
export function usePersistentState(
    key: string,
    initialValue: boolean,
): [boolean, (updater: boolean | ((prev: boolean) => boolean)) => void] {
    const getSnapshot = () => {
        try {
            const item = localStorage.getItem(key);
            return item !== null ? item === "true" : initialValue;
        } catch {
            return initialValue;
        }
    };

    const subscribe = (callback: () => void) => {
        const handler = (e: Event) => {
            if (e instanceof StorageEvent && e.key !== key && e.key !== null) {
                return;
            }
            callback();
        };

        window.addEventListener("storage", handler);
        window.addEventListener(`persist:${key}`, handler);

        return () => {
            window.removeEventListener("storage", handler);
            window.removeEventListener(`persist:${key}`, handler);
        };
    };

    const value = useSyncExternalStore(
        subscribe,
        getSnapshot,
        () => initialValue,
    );

    const setValue = useCallback(
        (updater: boolean | ((prev: boolean) => boolean)) => {
            const current = getSnapshot();
            const next =
                typeof updater === "function" ? updater(current) : updater;
            try {
                localStorage.setItem(key, String(next));
            } catch (err) {
                console.error(`Failed to persist key "${key}":`, err);
            }
            window.dispatchEvent(new CustomEvent(`persist:${key}`));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [key, initialValue],
    );

    return [value, setValue];
}
