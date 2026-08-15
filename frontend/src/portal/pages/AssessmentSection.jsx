import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Cloud,
  CloudOff,
  Loader2,
  Lock,
  Save,
} from "lucide-react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import { toast } from "sonner";
import { api } from "@/lib/api";
import { apiError } from "../PortalAuthContext";

import {
  BandBadge,
  Card,
  inpCls,
  ProgressBar,
  StatusBadge,
} from "./ui";

import { EvidenceUploader } from "./EvidenceUploader";

export default function AssessmentSection() {
  const { id, slug } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [responses, setResponses] = useState({});
  const [evidence, setEvidence] = useState({});
  const [saveState, setSaveState] = useState("idle");
  const [busy, setBusy] = useState(false);

  const debounceRef = useRef(null);
  const dirtyRef = useRef(false);

  /*
   * Load section data from MongoDB using backend API.
   */
  const load = useCallback(async () => {
    try {
      const response = await api.get(
        `/client/projects/${id}/assessment/${slug}`
      );

      const result = response.data;
      const savedResponses = {};
      const savedEvidence = {};

      let needsScoreSync = false;

      result.section.criteria.forEach(
        (criterion) => {
          const criterionFiles =
            criterion.evidence || [];

          const criterionResponse = {
            ...(criterion.response || {}),
          };

          savedEvidence[criterion.id] =
            criterionFiles;

          /*
           * Optional-credit rule:
           *
           * Evidence available = full fixed points
           * No evidence         = zero points
           */
          if (!criterion.mandatory) {
            const expectedPoints =
              criterionFiles.length > 0
                ? criterion.max_points
                : 0;

            const currentPoints = Number(
              criterionResponse.claimed_points || 0
            );

            if (currentPoints !== expectedPoints) {
              criterionResponse.claimed_points =
                expectedPoints;

              needsScoreSync = true;
            }
          }

          savedResponses[criterion.id] =
            criterionResponse;
        }
      );

      dirtyRef.current = needsScoreSync;

      setData(result);
      setResponses(savedResponses);
      setEvidence(savedEvidence);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      toast.error(
        apiError(error.response?.data?.detail) ||
          "Cannot open section"
      );

      navigate(`/portal/projects/${id}`, {
        replace: true,
      });
    }
  }, [id, slug, navigate]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const editable = data?.editable;
  const section = data?.section;

  /*
   * Current section live score.
   */
  const localScore = useMemo(() => {
    if (!section) return 0;

    let calculatedScore = 0;

    section.criteria.forEach((criterion) => {
      if (criterion.mandatory) return;

      const claimedPoints = Number(
        responses[criterion.id]
          ?.claimed_points || 0
      );

      calculatedScore += Math.max(
        0,
        Math.min(
          claimedPoints,
          criterion.max_points
        )
      );
    });

    return Math.min(
      calculatedScore,
      section.max_points
    );
  }, [responses, section]);

  /*
   * Previously saved score of current section.
   */
  const savedSectionScore = Number(
    data?.score?.categories?.[section?.id] || 0
  );

  /*
   * Instant overall claimed score.
   */
  const liveClaimedTotal = useMemo(() => {
    if (!data?.score || !section) return 0;

    const savedTotal = Number(
      data.score.claimed_total || 0
    );

    const totalMaximum = Number(
      data.score.total_max || 100
    );

    const calculatedTotal =
      savedTotal -
      savedSectionScore +
      localScore;

    return Math.max(
      0,
      Math.min(
        totalMaximum,
        Number(calculatedTotal.toFixed(1))
      )
    );
  }, [
    data?.score,
    section,
    savedSectionScore,
    localScore,
  ]);

  /*
   * Save responses and score in MongoDB.
   */
  const saveDraft = useCallback(
    async (showToast = false) => {
      setSaveState("saving");

      try {
        const response = await api.put(
          `/client/projects/${id}/assessment/${slug}`,
          {
            responses,
          }
        );

        const result = response.data;

        setData((current) => {
          if (!current) return current;

          return {
            ...current,
            score:
              result.score || current.score,
            sections:
              result.sections ||
              current.sections,
          };
        });

        dirtyRef.current = false;
        setSaveState("saved");

        if (showToast) {
          toast.success(
            "Draft and claimed score saved"
          );
        }
      } catch (error) {
        setSaveState("error");

        if (showToast) {
          toast.error(
            apiError(
              error.response?.data?.detail
            ) || "Unable to save draft"
          );
        }
      }
    },
    [id, slug, responses]
  );

  /*
   * Update criterion response.
   */
  const setCriterion = (
    criterionId,
    patch
  ) => {
    if (!editable) return;

    dirtyRef.current = true;

    setResponses((current) => ({
      ...current,

      [criterionId]: {
        ...(current[criterionId] || {}),
        ...patch,
      },
    }));

    setSaveState("idle");
  };

  /*
   * Evidence changes automatically update points.
   */
  const handleEvidenceChange = (
    criterion,
    updatedFiles
  ) => {
    setEvidence((current) => ({
      ...current,
      [criterion.id]: updatedFiles,
    }));

    if (!criterion.mandatory) {
      setCriterion(criterion.id, {
        claimed_points:
          updatedFiles.length > 0
            ? criterion.max_points
            : 0,
      });
    }
  };

  /*
   * Auto-save after 1.3 seconds.
   */
  useEffect(() => {
    if (!editable || !dirtyRef.current) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      saveDraft(false);
    }, 1300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [responses, editable, saveDraft]);

  /*
   * Save section and open next section.
   */
  const saveAndContinue = async () => {
    const mandatoryCriteria =
      section.criteria.filter(
        (criterion) => criterion.mandatory
      );

    const mandatoryCompleted =
      mandatoryCriteria.every(
        (criterion) =>
          responses[criterion.id]?.met === true
      );

    if (!mandatoryCompleted) {
      toast.error(
        "Complete all mandatory requirements before continuing."
      );

      return;
    }

    setBusy(true);

    try {
      const response = await api.put(
        `/client/projects/${id}/assessment/${slug}`,
        {
          responses,
          completed_categories: ["_"],
        }
      );

      const result = response.data;

      dirtyRef.current = false;

      if (result.next_slug) {
        toast.success("Section saved");

        navigate(
          `/portal/projects/${id}/assessment/${result.next_slug}`
        );
      } else {
        toast.success(
          "All sections completed — review and submit"
        );

        navigate(`/portal/projects/${id}`);
      }
    } catch (error) {
      toast.error(
        apiError(error.response?.data?.detail) ||
          "Unable to save section"
      );
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#27F580]" />
      </div>
    );
  }

  const mandatoryCriteria =
    section.criteria.filter(
      (criterion) => criterion.mandatory
    );

  const optionalCredits =
    section.criteria.filter(
      (criterion) => !criterion.mandatory
    );

  const SaveStateIcon =
    saveState === "saving"
      ? Loader2
      : saveState === "error"
      ? CloudOff
      : Cloud;

  return (
    <div data-testid="assessment-section">
      <Link
        to={`/portal/projects/${id}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-[#667085] transition-colors hover:text-[#172033]"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to project
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Left-side summary */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="!p-4">
            <div className="text-xs text-[#667085]">
              {data.summary.name}
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-medium text-[#111827]">
                {data.summary.project_type}
              </span>

              <StatusBadge
                status={data.summary.status}
              />
            </div>

            <div className="mt-3 flex items-end justify-between">
              <div
                className="text-2xl font-semibold text-[#172033]"
                data-testid="section-total-score"
              >
                {liveClaimedTotal}

                <span className="text-sm text-[#667085]">
                  /{data.score.total_max}
                </span>
              </div>

              <BandBadge band={data.score.band} />
            </div>

            <ProgressBar
              value={liveClaimedTotal}
              max={data.score.total_max}
            />
          </Card>

          {/* Section navigation */}
          <div className="space-y-1.5">
            {data.sections.map(
              (sectionItem, index) => {
                const SectionIcon =
                  sectionItem.state === "complete"
                    ? Check
                    : sectionItem.state === "locked"
                    ? Lock
                    : CircleDot;

                const clickable =
                  sectionItem.state !== "locked";

                const active =
                  sectionItem.slug === slug;

                const sectionScore =
                  sectionItem.id === section.id
                    ? localScore
                    : Number(
                        data.score.categories?.[
                          sectionItem.id
                        ] || 0
                      );

                return (
                  <button
                    key={sectionItem.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (clickable) {
                        navigate(
                          `/portal/projects/${id}/assessment/${sectionItem.slug}`
                        );
                      }
                    }}
                    data-testid={`stepper-${sectionItem.slug}`}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-[#E9FFF2] font-medium text-[#172033]"
                        : clickable
                        ? "text-[#667085] hover:bg-[#F6F8FA]"
                        : "cursor-not-allowed text-[#667085]/40"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                        sectionItem.state ===
                          "complete" || active
                          ? "bg-[#27F580] text-[#172033]"
                          : "bg-[#F6F8FA] text-[#667085]"
                      }`}
                    >
                      <SectionIcon className="h-3.5 w-3.5" />
                    </span>

                    <span className="min-w-0 flex-1 truncate">
                      {index + 1}.{" "}
                      {sectionItem.name}
                    </span>

                    <span className="shrink-0 text-xs text-[#667085]">
                      {sectionScore}/
                      {sectionItem.max_points}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Current section */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h1
              className="text-2xl font-serif text-[#172033]"
              data-testid="section-title"
            >
              {section.name}
            </h1>

            {editable && (
              <span
                className="inline-flex items-center gap-1.5 text-xs text-[#667085]"
                data-testid="autosave-status"
              >
                <SaveStateIcon
                  className={`h-3.5 w-3.5 ${
                    saveState === "saving"
                      ? "animate-spin"
                      : ""
                  }`}
                />

                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                  ? "Save failed"
                  : "Auto-save on"}
              </span>
            )}
          </div>

          <p className="mb-4 text-xs text-[#667085]">
            Claimed {localScore}/
            {section.max_points} points · Section{" "}
            {data.sections.findIndex(
              (item) => item.slug === slug
            ) + 1}{" "}
            of {data.sections.length}
          </p>

          {!editable && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
              <Lock className="h-4 w-4" />
              Submitted — read-only
            </div>
          )}

          {/* Mandatory requirements */}
          {mandatoryCriteria.length > 0 && (
            <div className="mb-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">
                Mandatory requirements
              </div>

              <div className="space-y-3">
                {mandatoryCriteria.map(
                  (criterion) => (
                    <div
                      key={criterion.id}
                      className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm"
                      data-testid={`criterion-${criterion.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-[#111827]">
                            {criterion.name}
                          </div>

                          <div className="mt-0.5 text-xs text-[#667085]">
                            {criterion.code} ·
                            prerequisite
                          </div>
                        </div>

                        <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-[#F6F8FA] px-3 py-2">
                          <input
                            type="checkbox"
                            disabled={!editable}
                            checked={
                              responses[
                                criterion.id
                              ]?.met === true
                            }
                            onChange={(event) =>
                              setCriterion(
                                criterion.id,
                                {
                                  met: event.target
                                    .checked,
                                }
                              )
                            }
                            className="h-4 w-4 accent-[#27F580]"
                            data-testid={`met-${criterion.id}`}
                          />

                          <span className="text-sm font-medium text-[#172033]">
                            Met
                          </span>
                        </label>
                      </div>

                      <EvidenceUploader
                        projectId={id}
                        criterionId={criterion.id}
                        files={
                          evidence[criterion.id]
                        }
                        editable={editable}
                        onChange={(updatedFiles) =>
                          handleEvidenceChange(
                            criterion,
                            updatedFiles
                          )
                        }
                      />
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Optional credits */}
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#667085]">
            Optional credits
          </div>

          <div className="space-y-3">
            {optionalCredits.map((criterion) => {
              const criterionEvidence =
                evidence[criterion.id] || [];

              const isClaimed =
                criterionEvidence.length > 0;

              return (
                <div
                  key={criterion.id}
                  className={`rounded-xl border bg-white p-4 transition-all ${
                    isClaimed
                      ? "border-[#27F580] shadow-[0_4px_14px_rgba(39,245,128,0.10)]"
                      : "border-[#E4E7EC] shadow-sm"
                  }`}
                  data-testid={`criterion-${criterion.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Only criterion name */}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#111827]">
                        {criterion.name}
                      </div>
                    </div>

                    {/* Only fixed points */}
                    <span
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${
                        isClaimed
                          ? "bg-[#E9FFF2] text-[#172033] ring-[#27F580]"
                          : "bg-[#F6F8FA] text-[#172033] ring-[#E4E7EC]"
                      }`}
                    >
                      {criterion.max_points}{" "}
                      {criterion.max_points === 1
                        ? "point"
                        : "points"}
                    </span>
                  </div>

                  <input
                    className={`${inpCls} mt-3 text-xs`}
                    placeholder="Notes / evidence reference (optional)"
                    disabled={!editable}
                    value={
                      responses[criterion.id]
                        ?.notes ?? ""
                    }
                    onChange={(event) =>
                      setCriterion(criterion.id, {
                        notes: event.target.value,
                      })
                    }
                  />

                  <EvidenceUploader
                    projectId={id}
                    criterionId={criterion.id}
                    files={criterionEvidence}
                    editable={editable}
                    onChange={(updatedFiles) =>
                      handleEvidenceChange(
                        criterion,
                        updatedFiles
                      )
                    }
                  />
                </div>
              );
            })}
          </div>

          {/* Actions */}
          {editable && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E7EC] pt-4">
              <div className="flex flex-wrap items-center gap-2">
                {data.prev_slug && (
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/portal/projects/${id}/assessment/${data.prev_slug}`
                      )
                    }
                    className="inline-flex items-center gap-1 text-sm text-[#667085] hover:text-[#172033]"
                    data-testid="section-prev"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => saveDraft(true)}
                  data-testid="section-save-draft"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-white px-3.5 py-2 text-sm font-medium text-[#172033] transition-colors hover:bg-[#F6F8FA]"
                >
                  <Save className="h-4 w-4" />
                  Save Draft
                </button>
              </div>

              <button
                type="button"
                onClick={saveAndContinue}
                disabled={busy}
                data-testid="section-continue"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#27F580] px-4 py-2.5 text-sm font-semibold text-[#172033] transition-colors hover:bg-[#20DB72] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {data.is_last
                  ? "Save & Review"
                  : "Save & Continue"}

                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}