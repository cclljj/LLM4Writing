"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Identity = {
  username: string;
  name: string;
  school: string;
};

function readIdentity(): Identity {
  if (typeof window === "undefined") {
    return { username: "", name: "", school: "" };
  }
  return {
    username: localStorage.getItem("username") || "",
    name: localStorage.getItem("name") || "",
    school: localStorage.getItem("school") || ""
  };
}

export default function StudentTopHeader() {
  const router = useRouter();
  const [identity, setIdentity] = useState<Identity>(() => readIdentity());

  useEffect(() => {
    setIdentity(readIdentity());
    const onStorage = () => setIdentity(readIdentity());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const identityLabel = useMemo(() => {
    const { school, name, username } = identity;
    if (school && name && username) return `${school} – ${name} (${username})`;
    return username || "學生";
  }, [identity]);

  const logout = () => {
    localStorage.removeItem("username");
    localStorage.removeItem("name");
    localStorage.removeItem("school");
    localStorage.removeItem("classNumber");
    router.push("/login");
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ marginBottom: 0 }}>學生端課程首頁</h1>
        <div>
          <span className="badge" style={{ marginRight: 8 }}>
            {identityLabel}
          </span>
          <button type="button" className="secondary" style={{ width: "auto" }} onClick={logout}>
            登出
          </button>
        </div>
      </div>
    </div>
  );
}
