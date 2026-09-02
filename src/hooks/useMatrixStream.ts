"use client";

import { useEffect, useState } from "react";
import { AppStatus } from "@/app/api/matrix/route";

interface UseMatrixStreamResult {
    apps: AppStatus[];
    loading: boolean;
}

/**
 * Declarative hook for polling the /api/matrix status endpoint.
 */
export function useMatrixStream(
    intervalMs: number = 3000,
): UseMatrixStreamResult {
    const [apps, setApps] = useState<AppStatus[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let isMounted = true;

        const fetchMatrix = async () => {
            try {
                const res = await fetch("/api/matrix");
                const data = await res.json();
                if (isMounted) {
                    setApps(data.apps || []);
                }
            } catch (err) {
                console.error("Matrix poll crash:", err);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchMatrix();
        const intervalId = setInterval(fetchMatrix, intervalMs);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [intervalMs]);

    return { apps, loading };
}
