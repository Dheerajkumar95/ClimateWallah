import React, { createContext, useContext, useEffect, useState } from "react";
import { publicApi } from "@/lib/api";

const SettingsContext = createContext({ settings: {}, seo: {} });

export function SettingsProvider({ children }) {
  const [data, setData] = useState({ settings: {}, seo: {} });
  useEffect(() => {
    publicApi.get("/settings").then((r) => setData(r.data)).catch(() => {});
  }, []);
  return <SettingsContext.Provider value={data}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
