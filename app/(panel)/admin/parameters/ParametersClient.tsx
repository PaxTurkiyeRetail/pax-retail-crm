"use client";

import { useEffect, useMemo, useState } from "react";

type ParamGroup = {
  key: string;
  module?: string;
  category?: string;
  title: string;
  description?: string;
  type?: "boolean" | "number" | "text" | "phase";
};

type ParamRow = {
  id: string;
  group_key: string;
  param_key: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
  version: number;
};

type PhaseRow = {
  id: string;
  group_key: "faz_tanimlari" | "is_ortagi_faz_tanimlari";
  faz_no: number;
  asama_adi: string;
  owner: string | null;
  is_active: boolean;
  sort_order: number;
};

type EditState = {
  id: string;
  type?: "parameter" | "phase";
  groupKey?: "faz_tanimlari" | "is_ortagi_faz_tanimlari";
  fazNo?: number;
  label: string;
  value: string;
  sortOrder: string;
  isActive: boolean;
  version?: number;
} | null;

const MODULE_STYLE: Record<
  string,
  { icon: string; tone: string; help: string }
> = {
  "Sistem Ayarları": {
    icon: "⚙️",
    tone: "blue",
    help: "Raporlama, performans ve genel çalışma davranışları.",
  },
  Entegrasyonlar: {
    icon: "🔌",
    tone: "purple",
    help: "Jira ve dış sistem bağlantıları.",
  },
  "Liste Yönetimleri": {
    icon: "📋",
    tone: "slate",
    help: "Formlardaki dropdown ve seçim listeleri.",
  },
  "Müşteri Künye": {
    icon: "🏢",
    tone: "green",
    help: "Künye alanlarının alt kırılım ve liste değerleri.",
  },
  "İş Kuralları": {
    icon: "🧭",
    tone: "amber",
    help: "Kod değiştirmeden yönetilecek operasyon kuralları.",
  },
  "Güvenlik ve Tanı": {
    icon: "🛡️",
    tone: "red",
    help: "Teknik tanı, görünürlük ve güvenlik kontrolleri.",
  },
};

function moduleMeta(moduleName: string) {
  return (
    MODULE_STYLE[moduleName] || {
      icon: "▫️",
      tone: "slate",
      help: "Parametre grupları.",
    }
  );
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items));
}

function isListModule(moduleName: string) {
  return moduleName === "Liste Yönetimleri" || moduleName === "Müşteri Künye";
}

function isBooleanGroup(group?: ParamGroup) {
  return group?.type === "boolean";
}

function isNumberGroup(group?: ParamGroup) {
  return group?.type === "number";
}

function isPhaseGroup(group?: ParamGroup) {
  return (
    group?.type === "phase" ||
    group?.key === "faz_tanimlari" ||
    group?.key === "is_ortagi_faz_tanimlari"
  );
}

function displayValueLabel() {
  return "Görünen Ad";
}

export default function ParametersClient() {
  const [groups, setGroups] = useState<ParamGroup[]>([]);
  const [rows, setRows] = useState<ParamRow[]>([]);
  const [phaseRows, setPhaseRows] = useState<PhaseRow[]>([]);
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [sortOrder, setSortOrder] = useState("999");
  const [edit, setEdit] = useState<EditState>(null);
  const [jiraDraft, setJiraDraft] = useState<Record<string, string>>({});
  const [jiraSaving, setJiraSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/parameters", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Parametreler yüklenemedi.");
      const nextGroups: ParamGroup[] = data.groups ?? [];
      setGroups(nextGroups);
      setRows(data.rows ?? []);
      setPhaseRows(data.phaseRows ?? []);
      const first = nextGroups[0];
      setSelectedModule(
        (current) => current || first?.module || "Sistem Ayarları",
      );
      setSelectedCategory((current) => current || first?.category || "Genel");
      setSelectedGroup((current) => current || first?.key || "");
    } catch (err: any) {
      setError(err.message || "Parametreler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const modules = useMemo(
    () => uniq(groups.map((group) => group.module || "Genel")),
    [groups],
  );
  const moduleGroups = useMemo(
    () =>
      groups.filter((group) => (group.module || "Genel") === selectedModule),
    [groups, selectedModule],
  );
  const categories = useMemo(
    () => uniq(moduleGroups.map((group) => group.category || "Genel")),
    [moduleGroups],
  );
  const categoryGroups = useMemo(
    () =>
      moduleGroups.filter(
        (group) => (group.category || "Genel") === selectedCategory,
      ),
    [moduleGroups, selectedCategory],
  );
  const selectedDefinition =
    groups.find((group) => group.key === selectedGroup) ||
    categoryGroups[0] ||
    moduleGroups[0] ||
    groups[0];
  const selectedMeta = moduleMeta(selectedModule);

  useEffect(() => {
    const first = moduleGroups[0];
    if (
      first &&
      !moduleGroups.some(
        (group) => (group.category || "Genel") === selectedCategory,
      )
    ) {
      setSelectedCategory(first.category || "Genel");
      setSelectedGroup(first.key);
    }
  }, [moduleGroups, selectedCategory]);

  useEffect(() => {
    if (!selectedDefinition) return;
    if (!categoryGroups.some((group) => group.key === selectedGroup))
      setSelectedGroup(selectedDefinition.key);
  }, [categoryGroups, selectedDefinition, selectedGroup]);

  const visibleRows = useMemo(
    () =>
      rows
        .filter((row) => row.group_key === selectedGroup)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order || a.label.localeCompare(b.label, "tr"),
        ),
    [rows, selectedGroup],
  );

  const visiblePhaseRows = useMemo(
    () =>
      phaseRows
        .filter((row) => row.group_key === selectedGroup)
        .sort((a, b) => a.sort_order - b.sort_order || a.faz_no - b.faz_no),
    [phaseRows, selectedGroup],
  );

  const activeCount =
    rows.filter((row) => row.is_active).length +
    phaseRows.filter((row) => row.is_active).length;
  const inactiveCount = rows.length + phaseRows.length - activeCount;

  async function addParameter(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payloadValue = value || label;
      const phaseMode = isPhaseGroup(selectedDefinition);
      const res = await fetch("/api/admin/parameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          phaseMode
            ? {
                groupKey: selectedGroup,
                fazNo: Number(sortOrder),
                asamaAdi: label,
                owner: value,
                sortOrder: Number(sortOrder || 999),
              }
            : {
                groupKey: selectedGroup,
                label,
                value: payloadValue,
                sortOrder: Number(sortOrder || 999),
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Parametre kaydedilemedi.");
      setMessage("Parametre eklendi.");
      setLabel("");
      setValue("");
      setSortOrder("999");
      await load();
    } catch (err: any) {
      setError(err.message || "Parametre kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const phaseMode =
        edit.type === "phase" && Boolean(edit.groupKey && edit.fazNo != null);
      const phaseGroupKey = edit.groupKey;
      const res = await fetch("/api/admin/parameters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          phaseMode
            ? {
                groupKey: phaseGroupKey,
                fazNo: Number(edit.fazNo),
                asamaAdi: edit.label,
                owner: edit.value,
                sortOrder: Number(edit.sortOrder || edit.fazNo || 999),
                isActive: edit.isActive,
              }
            : {
                id: edit.id,
                label: edit.label,
                value: edit.value || edit.label,
                sortOrder: Number(edit.sortOrder || 999),
                isActive: edit.isActive,
                expectedVersion: edit.version,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Parametre güncellenemedi.");
      if (phaseMode)
        setPhaseRows((items) =>
          items.map((item) =>
            item.group_key === data.row.group_key &&
            item.faz_no === data.row.faz_no
              ? data.row
              : item,
          ),
        );
      else
        setRows((items) =>
          items.map((item) => (item.id === data.row.id ? data.row : item)),
        );
      setEdit(null);
      setMessage("Parametre güncellendi.");
    } catch (err: any) {
      setError(err.message || "Parametre güncellenemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function patchRow(
    row: ParamRow,
    patch: Partial<
      Pick<ParamRow, "label" | "value" | "sort_order" | "is_active">
    >,
  ) {
    setError("");
    setMessage("");
    const previous = rows;
    setRows((items) =>
      items.map((item) => (item.id === row.id ? { ...item, ...patch } : item)),
    );
    try {
      const res = await fetch("/api/admin/parameters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          label: patch.label,
          value: patch.value,
          sortOrder: patch.sort_order,
          isActive: patch.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Parametre güncellenemedi.");
      setRows((items) =>
        items.map((item) => (item.id === data.row.id ? data.row : item)),
      );
      setMessage("Parametre güncellendi.");
    } catch (err: any) {
      setRows(previous);
      setError(err.message || "Parametre güncellenemedi.");
    }
  }

  async function remove(row: ParamRow) {
    const ok = window.confirm(
      `${row.label} silinsin mi? Eski kayıtların metin değeri bozulmaz; sadece parametre listesinden kaldırılır.`,
    );
    if (!ok) return;
    setError("");
    setMessage("");
    try {
      const res = await fetch(
        `/api/admin/parameters?id=${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Parametre silinemedi.");
      setRows((items) => items.filter((item) => item.id !== row.id));
      setMessage("Parametre silindi.");
    } catch (err: any) {
      setError(err.message || "Parametre silinemedi.");
    }
  }

  const primaryRow = visibleRows[0];
  const isJiraCategory =
    selectedModule === "Entegrasyonlar" && selectedCategory === "Jira";

  async function saveJiraAll(e: React.FormEvent) {
    e.preventDefault();
    setJiraSaving(true);
    setError("");
    setMessage("");
    try {
      for (const group of categoryGroups) {
        const row = rows.find((r) => r.group_key === group.key);
        const draftValue = jiraDraft[group.key];
        if (draftValue === undefined) continue;
        if (group.key === "system_jira_api_token" && !draftValue.trim())
          continue;
        if (!row) continue;
        if (draftValue.trim() === row.value) continue;
        const res = await fetch("/api/admin/parameters", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.id,
            label: row.label,
            value: draftValue.trim(),
            sortOrder: row.sort_order,
            isActive: true,
          }),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(
            data.message || `${group.title} kaydedilemedi.`,
          );
        setRows((items) =>
          items.map((item) => (item.id === data.row.id ? data.row : item)),
        );
      }
      setJiraDraft({});
      setMessage("Jira ayarları kaydedildi.");
    } catch (err: any) {
      setError(err.message || "Jira ayarları kaydedilemedi.");
    } finally {
      setJiraSaving(false);
    }
  }

  return (
    <div className="parameters-workspace enterprise-settings">
      {(error || message) && (
        <div
          className="pax-card parameters-alert"
          data-kind={error ? "error" : "success"}
        >
          {error || message}
        </div>
      )}

      <div className="settings-overview">
        {modules.map((moduleName) => {
          const meta = moduleMeta(moduleName);
          const groupCount = groups.filter(
            (group) => (group.module || "Genel") === moduleName,
          ).length;
          const rowCount = rows.filter((row) =>
            groups.some(
              (group) =>
                group.key === row.group_key &&
                (group.module || "Genel") === moduleName,
            ),
          ).length;
          return (
            <button
              key={moduleName}
              type="button"
              className={`settings-module-card tone-${meta.tone}${selectedModule === moduleName ? " active" : ""}`}
              onClick={() => {
                const first = groups.find(
                  (group) => (group.module || "Genel") === moduleName,
                );
                setSelectedModule(moduleName);
                if (first) {
                  setSelectedCategory(first.category || "Genel");
                  setSelectedGroup(first.key);
                }
              }}
            >
              <span className="settings-module-icon">{meta.icon}</span>
              <strong>{moduleName}</strong>
              <small>{meta.help}</small>
              <em>
                {groupCount} grup · {rowCount} değer
              </em>
            </button>
          );
        })}
      </div>

      <div className="parameters-metrics">
        <div className="pax-card parameters-metric">
          <span>Seçili Alan</span>
          <strong>{selectedModule}</strong>
        </div>
        <div className="pax-card parameters-metric">
          <span>Aktif Değer</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="pax-card parameters-metric">
          <span>Pasif Değer</span>
          <strong>{inactiveCount}</strong>
        </div>
      </div>

      <div className="parameters-grid">
        <aside className="pax-card parameters-aside">
          <div className="parameters-aside-head">
            <span>
              {selectedMeta.icon} {selectedModule}
            </span>
            <button
              className="pax-btn secondary"
              type="button"
              onClick={load}
              disabled={loading}
            >
              Yenile
            </button>
          </div>
          <p className="settings-aside-help">{selectedMeta.help}</p>
          <div className="parameters-subtitle">Alt kırılım</div>
          <div className="parameters-category-list">
            {categories.map((category) => {
              const count = moduleGroups.filter(
                (group) => (group.category || "Genel") === category,
              ).length;
              return (
                <button
                  key={category}
                  type="button"
                  className={`parameters-category${selectedCategory === category ? " active" : ""}`}
                  onClick={() => {
                    const first = moduleGroups.find(
                      (group) => (group.category || "Genel") === category,
                    );
                    setSelectedCategory(category);
                    if (first) setSelectedGroup(first.key);
                  }}
                >
                  <strong>{category}</strong>
                  <span>{count} parametre grubu</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="pax-card parameters-main-card">
          <div className="parameters-main-head">
            <div>
              <span className="parameters-kicker">
                {selectedModule} / {selectedCategory}
              </span>
              <h2>{selectedDefinition?.title || "Parametre Grubu"}</h2>
              <p>
                {selectedDefinition?.description ||
                  "Bu alan kod/SQL değiştirmeden buradan yönetilir."}
              </p>
            </div>
            <span className={`settings-type-badge tone-${selectedMeta.tone}`}>
              {isPhaseGroup(selectedDefinition)
                ? "Faz Yönetimi"
                : isListModule(selectedModule)
                  ? "Liste Yönetimi"
                  : isBooleanGroup(selectedDefinition)
                    ? "Aç / Kapat"
                    : isNumberGroup(selectedDefinition)
                      ? "Sayısal Ayar"
                      : "Sistem Ayarı"}
            </span>
          </div>

          {!isJiraCategory && (
            <div
              className="parameters-tabs"
              role="tablist"
              aria-label="Parametre grupları"
            >
              {categoryGroups.map((group) => (
                <button
                  key={group.key}
                  type="button"
                  className={`parameters-tab${selectedGroup === group.key ? " active" : ""}`}
                  onClick={() => setSelectedGroup(group.key)}
                >
                  {group.title}
                </button>
              ))}
            </div>
          )}

          {isJiraCategory ? (
            <form
              className="parameters-form settings-single-form"
              onSubmit={saveJiraAll}
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              {categoryGroups.map((group) => {
                const row = rows.find((r) => r.group_key === group.key);
                const isToken = group.key === "system_jira_api_token";
                return (
                  <label key={group.key} className="pax-label">
                    {group.title}
                    <input
                      className="pax-input"
                      type={isToken ? "password" : "text"}
                      value={
                        jiraDraft[group.key] ??
                        (isToken ? "" : row?.value || "")
                      }
                      placeholder={isToken ? row?.value || "" : undefined}
                      onChange={(e) =>
                        setJiraDraft((d) => ({
                          ...d,
                          [group.key]: e.target.value,
                        }))
                      }
                    />
                  </label>
                );
              })}
              <button className="pax-btn" type="submit" disabled={jiraSaving}>
                {jiraSaving ? "Kaydediliyor..." : "Tümünü Kaydet"}
              </button>
            </form>
          ) : !isListModule(selectedModule) && primaryRow ? (
            <div className="settings-control-panel">
              {isBooleanGroup(selectedDefinition) ? (
                <label className="settings-switch-card">
                  <span>
                    <strong>{selectedDefinition?.title}</strong>
                    <small>{selectedDefinition?.description}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={
                      primaryRow.value === "true" && primaryRow.is_active
                    }
                    onChange={(e) =>
                      patchRow(primaryRow, {
                        value: e.target.checked ? "true" : "false",
                        is_active: true,
                      })
                    }
                  />
                </label>
              ) : (
                <form
                  className="parameters-form settings-single-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    // Hassas alanda (token) değer boşsa mevcut değeri ezme;
                    // sadece admin yeni bir değer yazdıysa gönder.
                    const patch: { label: string; value?: string } = {
                      label: value || primaryRow.label,
                    };
                    if (value.trim()) patch.value = value.trim();
                    patchRow(primaryRow, patch);
                    setValue("");
                  }}
                >
                  <label className="pax-label">
                    {selectedGroup === "system_jira_api_token"
                      ? "Yeni Değer (mevcut token maskeli gösterilir, değiştirmek için yaz)"
                      : "Değer"}
                    <input
                      className="pax-input"
                      type={
                        selectedGroup === "system_jira_api_token"
                          ? "password"
                          : "text"
                      }
                      value={
                        selectedGroup === "system_jira_api_token"
                          ? value
                          : value || primaryRow.value
                      }
                      placeholder={
                        selectedGroup === "system_jira_api_token"
                          ? primaryRow.value
                          : undefined
                      }
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </label>
                  <button className="pax-btn" type="submit">
                    Ayarı Kaydet
                  </button>
                </form>
              )}
            </div>
          ) : isPhaseGroup(selectedDefinition) ? (
            <>
              <form onSubmit={addParameter} className="parameters-form">
                <label className="pax-label">
                  Faz Adı
                  <input
                    className="pax-input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Örn: İş Ortağı İlk Temas"
                    required
                  />
                </label>
                <label className="pax-label">
                  Owner
                  <input
                    className="pax-input"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Örn: Account"
                  />
                </label>
                <label className="pax-label">
                  Faz No
                  <input
                    className="pax-input"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    required
                  />
                </label>
                <button className="pax-btn" disabled={saving || !selectedGroup}>
                  {saving ? "Kaydediliyor..." : "Yeni Faz Ekle"}
                </button>
              </form>

              <div className="parameters-table-wrap">
                <table className="pax-table parameters-table">
                  <thead>
                    <tr>
                      <th>Faz</th>
                      <th>Owner</th>
                      <th>Durum</th>
                      <th style={{ textAlign: "right" }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={4}>Yükleniyor...</td>
                      </tr>
                    ) : visiblePhaseRows.length === 0 ? (
                      <tr>
                        <td colSpan={4}>Bu grupta faz tanımı yok.</td>
                      </tr>
                    ) : (
                      visiblePhaseRows.map((row) => (
                        <tr
                          key={`${row.group_key}-${row.faz_no}`}
                          style={{ opacity: row.is_active ? 1 : 0.62 }}
                        >
                          <td>
                            <strong>FAZ {row.faz_no}</strong>
                            <div className="parameters-row-key">
                              {row.asama_adi}
                            </div>
                          </td>
                          <td>{row.owner || "-"}</td>
                          <td>
                            <span
                              className={`parameters-status ${row.is_active ? "active" : "passive"}`}
                            >
                              {row.is_active ? "Aktif" : "Pasif"}
                            </span>
                          </td>
                          <td className="parameters-actions">
                            <button
                              className="pax-btn secondary"
                              type="button"
                              onClick={() =>
                                setEdit({
                                  id: `${row.group_key}:${row.faz_no}`,
                                  type: "phase",
                                  groupKey: row.group_key,
                                  fazNo: row.faz_no,
                                  label: row.asama_adi,
                                  value: row.owner || "",
                                  sortOrder: String(
                                    row.sort_order ?? row.faz_no,
                                  ),
                                  isActive: row.is_active,
                                })
                              }
                            >
                              Düzenle
                            </button>
                            <button
                              className="pax-btn secondary"
                              type="button"
                              onClick={async () => {
                                setError("");
                                setMessage("");
                                const res = await fetch(
                                  "/api/admin/parameters",
                                  {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      groupKey: row.group_key,
                                      fazNo: row.faz_no,
                                      isActive: !row.is_active,
                                    }),
                                  },
                                );
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok)
                                  setError(
                                    data.message || "Faz güncellenemedi.",
                                  );
                                else {
                                  setPhaseRows((items) =>
                                    items.map((item) =>
                                      item.group_key === row.group_key &&
                                      item.faz_no === row.faz_no
                                        ? data.row
                                        : item,
                                    ),
                                  );
                                  setMessage("Faz güncellendi.");
                                }
                              }}
                            >
                              {row.is_active ? "Pasife Al" : "Aktif Et"}
                            </button>
                            <button
                              className="pax-btn secondary"
                              type="button"
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `FAZ ${row.faz_no} silinsin mi?`,
                                  )
                                )
                                  return;
                                const res = await fetch(
                                  `/api/admin/parameters?groupKey=${encodeURIComponent(row.group_key)}&fazNo=${encodeURIComponent(String(row.faz_no))}`,
                                  { method: "DELETE" },
                                );
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok)
                                  setError(data.message || "Faz silinemedi.");
                                else {
                                  setPhaseRows((items) =>
                                    items.filter(
                                      (item) =>
                                        !(
                                          item.group_key === row.group_key &&
                                          item.faz_no === row.faz_no
                                        ),
                                    ),
                                  );
                                  setMessage("Faz silindi.");
                                }
                              }}
                            >
                              Sil
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <form onSubmit={addParameter} className="parameters-form">
                <label className="pax-label">
                  {displayValueLabel()}
                  <input
                    className="pax-input"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="Örn: Yeni Kasa Firması"
                    required
                  />
                </label>
                <label className="pax-label">
                  Form/DB Değeri
                  <input
                    className="pax-input"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Boşsa görünen ad kullanılır"
                  />
                </label>
                <label className="pax-label">
                  Sıra
                  <input
                    className="pax-input"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                  />
                </label>
                <button className="pax-btn" disabled={saving || !selectedGroup}>
                  {saving ? "Kaydediliyor..." : "Yeni Değer Ekle"}
                </button>
              </form>

              <div className="parameters-table-wrap">
                <table className="pax-table parameters-table">
                  <thead>
                    <tr>
                      <th>{displayValueLabel()}</th>
                      <th>Form/DB Değeri</th>
                      <th>Sıra</th>
                      <th>Durum</th>
                      <th style={{ textAlign: "right" }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5}>Yükleniyor...</td>
                      </tr>
                    ) : visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Bu grupta parametre yok.</td>
                      </tr>
                    ) : (
                      visibleRows.map((row) => (
                        <tr
                          key={row.id}
                          style={{ opacity: row.is_active ? 1 : 0.62 }}
                        >
                          <td>
                            <strong>{row.label}</strong>
                            <div className="parameters-row-key">
                              {row.param_key}
                            </div>
                          </td>
                          <td>{row.value}</td>
                          <td>{row.sort_order}</td>
                          <td>
                            <span
                              className={`parameters-status ${row.is_active ? "active" : "passive"}`}
                            >
                              {row.is_active ? "Aktif" : "Pasif"}
                            </span>
                          </td>
                          <td className="parameters-actions">
                            <button
                              className="pax-btn secondary"
                              type="button"
                              onClick={() =>
                                setEdit({
                                  id: row.id,
                                  type: "parameter",
                                  label: row.label,
                                  value: row.value,
                                  sortOrder: String(row.sort_order),
                                  isActive: row.is_active,
                                  version: row.version,
                                })
                              }
                            >
                              Düzenle
                            </button>
                            <button
                              className="pax-btn secondary"
                              type="button"
                              onClick={() =>
                                patchRow(row, { is_active: !row.is_active })
                              }
                            >
                              {row.is_active ? "Pasife Al" : "Aktif Et"}
                            </button>
                            <button
                              className="pax-btn secondary"
                              type="button"
                              onClick={() => remove(row)}
                            >
                              Sil
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      {edit && (
        <div
          className="parameters-modal-backdrop"
          role="presentation"
          onMouseDown={() => setEdit(null)}
        >
          <form
            className="pax-card parameters-modal"
            onSubmit={saveEdit}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <span className="parameters-kicker">Düzenle</span>
              <h3>
                {edit.type === "phase" ? "Faz Tanımı" : "Parametre Değeri"}
              </h3>
              <p>
                {edit.type === "phase"
                  ? "Faz adı, owner, sıralama ve aktiflik tek yerden güncellenir. Faz no değiştirmek için silip yeniden ekle."
                  : "Görünen ad, sıralama ve aktiflik güncellenir. Kanonik kod veri bütünlüğü için değiştirilemez."}
              </p>
            </div>
            <label className="pax-label">
              {edit.type === "phase" ? "Faz Adı" : "Görünen Ad / Sorumlu"}
              <input
                className="pax-input"
                value={edit.label}
                onChange={(e) => setEdit({ ...edit, label: e.target.value })}
                required
              />
            </label>
            <label className="pax-label">
              {edit.type === "phase" ? "Owner" : "Kanonik Kod"}
              <input
                className="pax-input"
                value={edit.value}
                onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                required={edit.type !== "phase"}
                disabled={edit.type !== "phase"}
              />
            </label>
            <label className="pax-label">
              Sıra
              <input
                className="pax-input"
                type="number"
                value={edit.sortOrder}
                onChange={(e) =>
                  setEdit({ ...edit, sortOrder: e.target.value })
                }
              />
            </label>
            <label className="parameters-check">
              <input
                type="checkbox"
                checked={edit.isActive}
                onChange={(e) =>
                  setEdit({ ...edit, isActive: e.target.checked })
                }
              />
              Aktif seçimlerde göster
            </label>
            <div className="parameters-modal-actions">
              <button
                className="pax-btn secondary"
                type="button"
                onClick={() => setEdit(null)}
              >
                Vazgeç
              </button>
              <button className="pax-btn" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
