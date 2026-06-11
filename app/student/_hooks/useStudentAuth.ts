"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchStudentJson, getStudentRetryableMessage, StudentFetchError } from "@/src/lib/student-page-helpers";

// Auth bootstrap for the student page (#459): verifies the session cookie,
// redirects to /login only on confirmed 401, and keeps transient failures
// recoverable via retryAuth.
export function useStudentAuth() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authRetryNonce, setAuthRetryNonce] = useState(0);
  const [loginUser, setLoginUser] = useState("");

  useEffect(() => {
    let canceled = false;
    fetchStudentJson<{ authenticated?: boolean; user?: { username?: string } }>("/api/auth/me", { cache: "no-store" })
      .then(({ data }) => {
        if (canceled) return;
        if (data?.authenticated && data?.user?.username) {
          setLoginUser(data.user.username);
          setAuthError("");
        } else {
          setLoginUser("");
          router.push("/login");
        }
      })
      .catch((error) => {
        if (canceled) return;
        setLoginUser("");
        if (error instanceof StudentFetchError && error.status === 401) {
          router.push("/login");
          return;
        }
        setAuthError(getStudentRetryableMessage("auth"));
      })
      .finally(() => {
        if (!canceled) setAuthReady(true);
      });
    return () => {
      canceled = true;
    };
  }, [authRetryNonce, router]);

  const retryAuth = () => {
    setAuthReady(false);
    setAuthError("");
    setAuthRetryNonce((value) => value + 1);
  };

  return { authReady, authError, loginUser, retryAuth };
}
