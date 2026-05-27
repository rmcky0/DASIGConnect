import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  createDraft,
  deleteDraft,
  getSubmission,
  submitForReview,
  updateDraft,
  uploadSubmissionMedia,
  validateGuardRails,
  type GuardRailResult,
  type SavedMediaAsset,
  type SubmissionPayload,
  type SubmissionStatus,
  type SubmissionSummary,
} from "../../api/submissionApi";
import {
  useSubmissionLookups,
  useSubmissions,
} from "../../hooks/useSubmissions";
import type { User } from "../../types/auth.types";
import { useToast } from "../../context/ToastContext";

interface SubmissionScreenProps {
  user: User;
}

interface FormState {
  id: string | null;
  eventTitle: string;
  eventDate: string;
  caption: string;
  description: string;
  category: string;
  scheduledDate: string;
  scheduledTime: string;
  tags: string[];
  files: File[];
  savedAssets: SavedMediaAsset[];
}

type QueueFilter = "drafts" | "submitted" | "all";
type ModalState =
  | "submit"
  | "success"
  | "delete"
  | "draft-choice"
  | "draft-exit"
  | null;
type SaveState = "idle" | "saving" | "saved";
type ProgressStep = "media" | "details" | "schedule";
type SubmitBlocker = {
  label: string;
  step: ProgressStep;
};
type PopoverPlacement = "drop-down" | "drop-up";

const initialForm: FormState = {
  id: null,
  eventTitle: "",
  eventDate: "",
  caption: "",
  description: "",
  category: "",
  scheduledDate: "",
  scheduledTime: "",
  tags: [],
  files: [],
  savedAssets: [],
};

const statusLabels: Record<SubmissionStatus, string> = {
  draft: "Draft",
  pending: "Submitted",
  in_review: "Under Review",
  needs_revision: "Needs Revision",
  scheduled: "Scheduled",
  publish_failed: "Publish Failed",
  published: "Published",
  published_manual: "Published",
  admin_direct_post: "Direct Post",
  rejected: "Rejected",
};

export default function SubmissionScreen({ user }: SubmissionScreenProps) {
  const navigate = useNavigate();
  const { submissions, setSubmissions, loading, error, refresh } =
    useSubmissions();
  const {
    lookups,
    loading: lookupsLoading,
    error: lookupsError,
  } = useSubmissionLookups();
  const toast = useToast();
  const [filter, setFilter] = useState<QueueFilter>("drafts");
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [modal, setModal] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hydratingId, setHydratingId] = useState<string | null>(null);
  const [refreshingQueue, setRefreshingQueue] = useState(false);
  const [guardRailsLoading, setGuardRailsLoading] = useState(false);
  const [guardRails, setGuardRails] = useState<GuardRailResult | null>(null);
  const [guardRailError, setGuardRailError] = useState("");
  const [activeStep, setActiveStep] = useState<ProgressStep>("media");
  const [selectedStatus, setSelectedStatus] = useState<SubmissionStatus | null>(
    null,
  );

  const queued = useMemo(() => {
    if (filter === "drafts")
      return submissions.filter((item) => item.status === "draft");
    if (filter === "submitted")
      return submissions.filter((item) => item.status !== "draft");
    return submissions;
  }, [filter, submissions]);

  const draftCount = useMemo(
    () => submissions.filter((item) => item.status === "draft").length,
    [submissions],
  );

  const submittedCount = useMemo(
    () => submissions.filter((item) => item.status !== "draft").length,
    [submissions],
  );

  const scheduledAt = useMemo(() => {
    if (!form.scheduledDate || !form.scheduledTime) return undefined;
    const date = new Date(`${form.scheduledDate}T${form.scheduledTime}`);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString();
  }, [form.scheduledDate, form.scheduledTime]);

  const readiness = useMemo(
    () => calculateReadiness(form, guardRails),
    [form, guardRails],
  );
  const previewCaption =
    form.caption.trim() ||
    "Your caption preview will appear here as you write.";
  const hasMedia = form.savedAssets.length > 0 || form.files.length > 0;
  const isReadOnlySubmission = selectedStatus !== null && selectedStatus !== "draft";
  const busy = saveState === "saving" || submitting || deleting;
  const submitBlockers = useMemo(
    () =>
      getSubmitBlockers(
        form,
        scheduledAt,
        lookups.allowedFileTypes,
        lookups.maxFileSizeMb,
      ),
    [form, lookups.allowedFileTypes, lookups.maxFileSizeMb, scheduledAt],
  );

  const progressSteps = useMemo(
    () => [
      {
        id: "media" as const,
        label: "Media Assets",
        complete: hasMedia,
      },
      {
        id: "details" as const,
        label: "Post Details",
        complete:
          Boolean(form.eventTitle.trim()) &&
          Boolean(form.eventDate) &&
          captionTone(form.caption) === "ok",
      },
      {
        id: "schedule" as const,
        label: "Preferred Schedule",
        complete: Boolean(scheduledAt),
      },
    ],
    [form.caption, form.eventDate, form.eventTitle, hasMedia, scheduledAt],
  );

  useEffect(() => {
    if (!scheduledAt) {
      setGuardRails(null);
      setGuardRailError("");
      setGuardRailsLoading(false);
      return;
    }

    setGuardRailsLoading(true);
    const timer = window.setTimeout(() => {
      validateGuardRails(scheduledAt)
        .then((response) => {
          setGuardRails(response.data);
          setGuardRailError("");
        })
        .catch((err: any) => {
          setGuardRails(null);
          setGuardRailError(
            err.response?.data?.error ||
              err.message ||
              "Slot validation is unavailable.",
          );
        })
        .finally(() => setGuardRailsLoading(false));
    }, 350);

    return () => window.clearTimeout(timer);
  }, [scheduledAt]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  function resetComposer() {
    setForm(initialForm);
    setSelectedFileIndex(0);
    setGuardRails(null);
    setGuardRailError("");
    setSaveState("idle");
    setFilter("drafts");
    setActiveStep("media");
    setSelectedStatus(null);
  }

  function startNewSubmission() {
    resetComposer();
    setModal(null);
    setActiveStep("media");
  }

  function handleBack() {
    if (!isReadOnlySubmission && isDirtyDraft(form)) {
      setModal("draft-exit");
      return;
    }
    navigate("/dashboard");
  }

  function handleNewSubmission() {
    if (isReadOnlySubmission) {
      startNewSubmission();
      return;
    }
    const existingDraft = submissions.find((item) => item.status === "draft");
    if (existingDraft || isDirtyDraft(form)) {
      setModal("draft-choice");
      return;
    }
    startNewSubmission();
  }

  function resumeExistingDraft() {
    const existingDraft =
      submissions.find((item) => item.status === "draft") ||
      (form.id ? submissions.find((item) => item.id === form.id) : undefined);
    setFilter("drafts");
    setModal(null);
    if (existingDraft) {
      void applySubmission(existingDraft);
      return;
    }
    setActiveStep("media");
  }

  async function refreshQueue() {
    if (refreshingQueue) return;
    setRefreshingQueue(true);
    try {
      await refresh();
    } finally {
      setRefreshingQueue(false);
    }
  }

  async function applySubmission(summary: SubmissionSummary) {
    setHydratingId(summary.id);
    try {
      const { data: submission } = await getSubmission(summary.id);
      setForm({
        id: submission.id,
        eventTitle: submission.eventTitle || "",
        eventDate: submission.eventDate || "",
        caption: submission.caption || "",
        description: submission.description || "",
        category: submission.category || "",
        scheduledDate: submission.scheduledAt
          ? submission.scheduledAt.slice(0, 10)
          : "",
        scheduledTime: submission.scheduledAt
          ? formatTimeInput(submission.scheduledAt)
          : "",
        tags: submission.tags ?? [],
        files: [],
        savedAssets: submission.mediaAssets ?? [],
      });
      setSelectedStatus(submission.status);
      setFilter(submission.status === "draft" ? "drafts" : "submitted");
      setSelectedFileIndex(0);
      setSaveState("saved");
      setActiveStep("media");
    } catch {
      toast.error("Could not load submission detail.");
    } finally {
      setHydratingId(null);
    }
  }

  async function saveDraft() {
    if (isReadOnlySubmission) return;
    if (busy) return false;
    setSaveState("saving");
    try {
      const payload = toPayload(form, scheduledAt);
      const response = form.id
        ? await updateDraft(form.id, payload)
        : await createDraft(payload);
      let finalResponse = response;
      if (form.files.length > 0) {
        const uploadResult = await uploadSubmissionMedia(
          response.data.id,
          form.files,
        );
        if (uploadResult) finalResponse = uploadResult as typeof response;
      }
      const savedAssets =
        (finalResponse.data as SubmissionSummary).mediaAssets ?? [];
      setForm((current) => ({
        ...current,
        id: finalResponse.data.id,
        files: [],
        savedAssets,
      }));
      setSubmissions((current) =>
        upsertSubmission(current, finalResponse.data),
      );
      setSaveState("saved");
      toast.success("Draft saved.");
      return true;
    } catch (err: any) {
      setSaveState("idle");
      toast.error(
        err.response?.data?.error || err.message || "Draft could not be saved.",
      );
      return false;
    }
  }

  async function handleSave() {
    await saveDraft();
  }

  async function handleSaveDraftAndExit() {
    const saved = await saveDraft();
    if (saved) {
      setModal(null);
      navigate("/dashboard");
    }
  }

  async function handleDiscardDraftAndExit() {
    if (busy) return;
    setDeleting(true);
    try {
      if (form.id) {
        await deleteDraft(form.id);
        setSubmissions((current) =>
          current.filter((item) => item.id !== form.id),
        );
      }
      resetComposer();
      setModal(null);
      toast.info("Draft discarded.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(
        err.response?.data?.error ||
          err.message ||
          "Draft could not be discarded.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function requestSubmitReview() {
    if (isReadOnlySubmission) return;
    if (busy || hydratingId) return;
    if (submitBlockers.length > 0) {
      setActiveStep(submitBlockers[0].step);
      const visibleBlockers = submitBlockers
        .slice(0, 3)
        .map((item) => item.label)
        .join(", ");
      const remainder =
        submitBlockers.length > 3
          ? ` and ${submitBlockers.length - 3} more`
          : "";
      toast.warning(`Complete required items first: ${visibleBlockers}${remainder}.`);
      return;
    }
    setModal("submit");
  }

  async function handleSubmit() {
    if (isReadOnlySubmission) return;
    if (busy) return;
    const blockers = getSubmitBlockers(
      form,
      scheduledAt,
      lookups.allowedFileTypes,
      lookups.maxFileSizeMb,
    );
    if (blockers.length > 0) {
      setModal(null);
      setActiveStep(blockers[0].step);
      toast.warning(
        `Submission is missing required items: ${blockers
          .map((item) => item.label)
          .join(", ")}.`,
      );
      return;
    }
    setSubmitting(true);
    try {
      const payload = toPayload(form, scheduledAt);
      const draft = form.id
        ? await updateDraft(form.id, payload)
        : await createDraft(payload);
      if (form.files.length > 0) {
        try {
          await uploadSubmissionMedia(draft.data.id, form.files);
        } catch (uploadErr: any) {
          toast.warning(
            "Media upload skipped: " +
              (uploadErr.message || "Supabase not configured"),
          );
        }
      }
      const submitted = await submitForReview(draft.data.id);
      setSubmissions((current) => upsertSubmission(current, submitted.data));
      resetComposer();
      setFilter("submitted");
      setModal("success");
      toast.success("Submission sent for review.");
      void refresh();
    } catch (err: any) {
      toast.error(
        err.response?.data?.error || err.message || "Submission failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (isReadOnlySubmission) return;
    if (busy) return;
    setDeleting(true);
    if (!form.id) {
      setForm(initialForm);
      setModal(null);
      setDeleting(false);
      return;
    }

    try {
      await deleteDraft(form.id);
      setSubmissions((current) =>
        current.filter((item) => item.id !== form.id),
      );
      setForm(initialForm);
      setModal(null);
      toast.info("Draft deleted.");
    } catch (err: any) {
      toast.error(
        err.response?.data?.error ||
          err.message ||
          "Draft could not be deleted.",
      );
    } finally {
      setDeleting(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    setForm((current) => ({
      ...current,
      files: [...current.files, ...Array.from(files)],
    }));
    setSelectedFileIndex(0);
    setSaveState("idle");
  }

  return (
    <div className="submission-screen">
      <nav className="sub-topnav">
        <div className="sub-nav-left">
          <button
            className="sub-back-btn"
            type="button"
            onClick={handleBack}
          >
            <i className="ti ti-arrow-left"></i>
          </button>
          <div className="sub-nav-brand">
            <div className="sub-nav-brand-icon">
              <BrandMark />
            </div>
            <div className="sub-nav-brand-name">
              DASIG<em>Connect</em>
            </div>
          </div>
          <div className="sub-nav-breadcrumb">
            <i className="ti ti-chevron-right"></i>
            <span>Submit Content</span>
          </div>
        </div>
        <div className="sub-nav-right">
          <div
            className={`sub-nav-save-status ${saveState === "saved" ? "saved" : ""}`}
          >
            <i
              className={
                saveState === "saving"
                  ? "ti ti-loader-2 sub-spin"
                  : saveState === "saved"
                    ? "ti ti-cloud-check"
                    : "ti ti-cloud"
              }
            ></i>
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "Draft saved"
                : "Unsaved draft"}
          </div>
          <div className="sub-nav-chip">{formatRole(user.role)}</div>
          <div className="sub-nav-avatar">{user.initials}</div>
        </div>
      </nav>

      {(loading || lookupsLoading || hydratingId) && (
        <div className="sub-route-loader" aria-hidden="true">
          <span></span>
        </div>
      )}

      <div className="sub-workspace">
        <aside className="sub-sidebar">
          <div className="sub-sidebar-header">
            <div className="sub-sidebar-title-row">
              <div>
                <div className="sub-sidebar-eyebrow">Workspace</div>
                <div className="sub-sidebar-title">Submission Queue</div>
              </div>
              <button
                className="sub-sidebar-count"
                type="button"
                onClick={() => void refreshQueue()}
                disabled={refreshingQueue || loading}
                aria-label="Refresh submissions"
              >
                {refreshingQueue || loading ? (
                  <i className="ti ti-loader-2 sub-spin"></i>
                ) : (
                  queued.length
                )}
              </button>
            </div>
            <div className="sub-sidebar-tabs">
              <button
                className={`sub-stab ${filter === "drafts" ? "active" : ""}`}
                type="button"
                onClick={() => setFilter("drafts")}
              >
                <span className="sub-stab-label">Drafts</span>
                <span className="sub-stab-badge">{draftCount}</span>
              </button>
              <button
                className={`sub-stab ${filter === "submitted" ? "active" : ""}`}
                type="button"
                onClick={() => setFilter("submitted")}
              >
                <span className="sub-stab-label">Submitted</span>
                <span className="sub-stab-badge">{submittedCount}</span>
              </button>
              <button
                className={`sub-stab ${filter === "all" ? "active" : ""}`}
                type="button"
                onClick={() => setFilter("all")}
              >
                <span className="sub-stab-label">All</span>
                <span className="sub-stab-badge">{submissions.length}</span>
              </button>
            </div>
          </div>
          <div className="sub-sidebar-list" aria-label="Submission queue">
            {loading && (
              <QueueSkeleton />
            )}
            {!loading && error && (
              <QueueState
                icon="ti-database-off"
                title="Unable to load submissions"
                description="Check your session and backend connection, then refresh the queue."
              />
            )}
            {!loading && !error && queued.length === 0 && (
              <QueueState
                icon="ti-folder-open"
                title="No submissions in this view"
              />
            )}
            {!loading &&
              !error &&
              queued.map((item) => (
                <button
                  className={`sub-queue-item ${item.id === form.id ? "active" : ""}`}
                  key={item.id}
                  type="button"
                  onClick={() => void applySubmission(item)}
                  disabled={Boolean(hydratingId)}
                  aria-busy={hydratingId === item.id}
                >
                  <div className="sub-qi-top">
                    <div className="sub-qi-title">
                      {item.eventTitle || "Untitled submission"}
                    </div>
                    <span className={`sub-qi-badge status-${item.status}`}>
                      {hydratingId === item.id ? "Loading" : statusLabels[item.status]}
                    </span>
                  </div>
                  <div className="sub-qi-meta">
                    <i className="ti ti-building"></i>
                    {item.institutionName || user.inst}
                    <span className="sub-qi-dot"></span>
                    {formatDate(item.eventDate)}
                  </div>
                  <div className="sub-qi-media">
                    <div className="sub-qi-thumb">
                      <i className="ti ti-photo"></i>
                    </div>
                    {(item.mediaCount ?? 0) > 1 && (
                      <div className="sub-qi-thumb">
                        +{(item.mediaCount ?? 0) - 1}
                      </div>
                    )}
                  </div>
                </button>
              ))}
          </div>
          <div className="sub-sidebar-new">
            <button
              className="sub-btn-new"
              type="button"
              onClick={handleNewSubmission}
              disabled={busy || Boolean(hydratingId)}
            >
              <i className="ti ti-plus"></i> New Submission
            </button>
          </div>
        </aside>

        <main className="sub-form-canvas">
          {hydratingId ? (
            <SubmissionHydrationSkeleton />
          ) : (
            <>
          <div className="sub-form-page-head">
            <div>
              <h1 className="sub-form-page-title">
                {isReadOnlySubmission ? "Submitted Preview" : "Submit Content"}
              </h1>
              <p className="sub-form-page-sub">
                {isReadOnlySubmission
                  ? "Preview exactly what was sent for validation."
                  : "Prepare event media, caption, tags, and a preferred publishing slot."}
              </p>
              {isReadOnlySubmission && selectedStatus && (
                <div className="sub-readonly-note">
                  <i className="ti ti-eye"></i>
                  Viewing {statusLabels[selectedStatus]} submission
                </div>
              )}
            </div>
            {!isReadOnlySubmission && (
              <div className="sub-form-page-actions">
              <button
                className="sub-btn-ghost danger"
                type="button"
                onClick={() => setModal("delete")}
                disabled={busy || Boolean(hydratingId) || isReadOnlySubmission}
              >
                {deleting ? <i className="ti ti-loader-2 sub-spin"></i> : <i className="ti ti-trash"></i>} Delete
              </button>
              <button
                className="sub-btn-ghost save"
                type="button"
                onClick={() => void handleSave()}
                disabled={busy || Boolean(hydratingId) || isReadOnlySubmission}
              >
                {saveState === "saving" ? <i className="ti ti-loader-2 sub-spin"></i> : <i className="ti ti-device-floppy"></i>} Save Draft
              </button>
              <button
                className="sub-btn-primary"
                type="button"
                onClick={requestSubmitReview}
                disabled={busy || Boolean(hydratingId) || isReadOnlySubmission}
              >
                {submitting ? <i className="ti ti-loader-2 sub-spin"></i> : <i className="ti ti-send"></i>} Submit for Review
              </button>
              </div>
            )}
          </div>

          {!isReadOnlySubmission && (
            <StepProgress
              steps={progressSteps}
              activeStep={activeStep}
              onStepClick={setActiveStep}
            />
          )}

          <section
            id="sub-step-media"
            className={`sub-form-section sub-step-panel ${isReadOnlySubmission || activeStep === "media" ? "active" : ""}`}
            hidden={!isReadOnlySubmission && activeStep !== "media"}
          >
            <SectionHead
              icon="ti-photo-up"
              tone="blue"
              title="Media Assets"
              subtitle={
                isReadOnlySubmission
                  ? "Media included in the submitted post."
                  : "Attach photos or videos from the event."
              }
            />
            {!isReadOnlySubmission && !hasMedia && (
              <label className="sub-upload-zone">
                <input
                  className="sub-file-input"
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  disabled={busy || Boolean(hydratingId)}
                  onChange={(event) => handleFiles(event.target.files)}
                />
                <div className="sub-upload-icon">
                  <i className="ti ti-cloud-upload"></i>
                </div>
                <div>
                  <div className="sub-upload-title">
                    Drop files here or browse
                  </div>
                  <div className="sub-upload-sub">
                    Images and videos are attached to the draft and uploaded when
                    you save.
                  </div>
                  <div className="sub-upload-types">
                    <span>JPG</span>
                    <span>PNG</span>
                    <span>MP4</span>
                    <span>MOV</span>
                  </div>
                </div>
              </label>
            )}
            {hasMedia && (
              <div className="sub-filmstrip">
                {form.savedAssets.map((asset) => (
                  <div className="sub-film-item" key={asset.id}>
                    {asset.fileType.startsWith("image") ||
                    ["jpeg", "jpg", "png", "webp", "gif"].includes(
                      asset.fileType,
                    ) ? (
                      <img src={asset.storageUrl} alt={asset.fileName} />
                    ) : (
                      <div className="sub-film-video">
                        <i className="ti ti-video"></i>
                      </div>
                    )}
                    <span className="sub-film-badge">
                      {asset.fileType.toUpperCase()}
                    </span>
                  </div>
                ))}
                {form.files.map((file, index) => (
                  <button
                    className={`sub-film-item ${selectedFileIndex === index ? "selected" : ""}`}
                    key={`${file.name}-${file.lastModified}`}
                    type="button"
                    onClick={() => setSelectedFileIndex(index)}
                  >
                    {file.type.startsWith("image/") ? (
                      <img src={filePreviewUrl(file)} alt={file.name} />
                    ) : (
                      <div className="sub-film-video">
                        <i className="ti ti-video"></i>
                      </div>
                    )}
                    <span className="sub-film-num">{index + 1}</span>
                    <span className="sub-film-badge">
                      {file.type.startsWith("video/") ? "VIDEO" : "IMAGE"}
                    </span>
                  <span
                    className="sub-film-del"
                    role="button"
                    tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        setForm((current) => ({
                          ...current,
                          files: current.files.filter(
                            (_, fileIndex) => fileIndex !== index,
                          ),
                        }));
                      }}
                    >
                      <i className="ti ti-x"></i>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!isReadOnlySubmission && hasMedia && (
              <div className="sub-media-add-row">
                <label className="sub-upload-zone compact">
                  <input
                    className="sub-file-input"
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    disabled={busy || Boolean(hydratingId)}
                    onChange={(event) => handleFiles(event.target.files)}
                  />
                  <div className="sub-upload-icon">
                    <i className="ti ti-plus"></i>
                  </div>
                  <div className="sub-upload-title">Add More Media</div>
                </label>
              </div>
            )}
            {isReadOnlySubmission && !hasMedia && (
              <div className="sub-preview-empty">
                <i className="ti ti-photo-off"></i>
                No media assets were attached to this submission.
              </div>
            )}
          </section>

          <section
            id="sub-step-details"
            className={`sub-form-section sub-step-panel ${isReadOnlySubmission || activeStep === "details" ? "active" : ""}`}
            hidden={!isReadOnlySubmission && activeStep !== "details"}
          >
            <SectionHead
              icon="ti-edit"
              tone="gold"
              title="Post Details"
              subtitle={
                isReadOnlySubmission
                  ? "Post information submitted for review."
                  : "Use backend field names for the saved submission draft."
              }
            />
            <div className="sub-field-row">
              <Field label="Event Title">
                <input
                  className="sub-finput"
                  readOnly={isReadOnlySubmission}
                  value={form.eventTitle}
                  onChange={(event) =>
                    updateField("eventTitle", event.target.value)
                  }
                />
              </Field>
              <Field label="Event Date">
                <CalendarDateField
                  value={form.eventDate}
                  readOnly={isReadOnlySubmission}
                  placeholder="Select event date"
                  onChange={(value) => updateField("eventDate", value)}
                />
              </Field>
            </div>
            <Field
              label="Caption"
              count={
                isReadOnlySubmission
                  ? undefined
                  : `${form.caption.length} / 500 chars`
              }
              tone={captionTone(form.caption)}
            >
              <textarea
                className={`sub-finput ${captionTone(form.caption)}`}
                rows={4}
                readOnly={isReadOnlySubmission}
                value={form.caption}
                onChange={(event) => updateField("caption", event.target.value)}
                placeholder="Write a compelling caption for the DASIG Facebook page..."
              />
              {!isReadOnlySubmission && (
                <div className="sub-finput-hint">
                  Captions between 150-500 characters perform best on Facebook.
                  Include relevant hashtags.
                </div>
              )}
            </Field>

            {!isReadOnlySubmission && (
              <div className="sub-ai-assist">
              <div className="sub-ai-icon">
                <i className="ti ti-sparkles"></i>
              </div>
              <div>
                <div className="sub-ai-title">AI caption assist</div>
                <div className="sub-ai-text">
                  AI caption generation will appear here when the backend
                  integration for media analysis is available.
                </div>
              </div>
              </div>
            )}

            <div className="sub-field-row">
              <Field label="Event Category">
                {isReadOnlySubmission ? (
                  <input
                    className="sub-finput"
                    value={form.category || "Uncategorized"}
                    readOnly
                  />
                ) : (
                  <select
                    className="sub-fselect"
                    value={form.category}
                    disabled={lookupsLoading}
                    onChange={(event) =>
                      updateField("category", event.target.value)
                    }
                  >
                    <option value="">
                      {lookupsLoading ? "Loading..." : "Select a category"}
                    </option>
                    {lookups.categories?.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Institution Scope">
                <input className="sub-finput" value={user.inst} readOnly />
              </Field>
            </div>

            <Field label="Tags">
              {lookupsError && !isReadOnlySubmission && (
                <div className="sub-inline-note">
                  Tag options could not be loaded. You can still save and
                  submit.
                </div>
              )}
              <div className="sub-tag-row">
                {lookupsLoading && !isReadOnlySubmission &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <span className="sub-tag-skeleton sub-shimmer" key={index}></span>
                  ))}
                {isReadOnlySubmission &&
                  form.tags.map((tag) => (
                    <span className="sub-tag active is-static" key={tag}>
                      {tag}
                    </span>
                  ))}
                {!isReadOnlySubmission && !lookupsLoading && lookups.availableTags?.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`sub-tag ${form.tags.includes(tag) ? "active" : ""}`}
                    disabled={isReadOnlySubmission}
                    onClick={() =>
                      updateField(
                        "tags",
                        form.tags.includes(tag)
                          ? form.tags.filter((t) => t !== tag)
                          : [...form.tags, tag],
                      )
                    }
                  >
                    {tag}
                  </button>
                ))}
                {isReadOnlySubmission && form.tags.length === 0 && (
                  <span className="sub-muted-text">No tags included.</span>
                )}
                {!isReadOnlySubmission && !lookupsLoading && !lookups.availableTags?.length && (
                  <span className="sub-muted-text">No tags available.</span>
                )}
              </div>
            </Field>

            <Field label="Description / Validator Notes">
              <textarea
                className="sub-finput"
                rows={2}
                readOnly={isReadOnlySubmission}
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Notes for your Validator..."
              />
            </Field>
          </section>

          <section
            id="sub-step-schedule"
            className={`sub-form-section sub-step-panel ${isReadOnlySubmission || activeStep === "schedule" ? "active" : ""}`}
            hidden={!isReadOnlySubmission && activeStep !== "schedule"}
          >
            <SectionHead
              icon="ti-calendar-event"
              tone="purple"
              title={isReadOnlySubmission ? "Submitted Schedule" : "Preferred Schedule"}
              subtitle={
                isReadOnlySubmission
                  ? "Schedule preference included in the submission."
                  : "Testing mode allows draft save and submit while guardrails are being tuned."
              }
            />
            <div className="sub-field-row">
              <Field label="Preferred Date">
                <CalendarDateField
                  value={form.scheduledDate}
                  readOnly={isReadOnlySubmission}
                  placeholder="Select preferred date"
                  onChange={(value) => updateField("scheduledDate", value)}
                />
              </Field>
              <Field label="Preferred Time">
                <TimePickerField
                  value={form.scheduledTime}
                  readOnly={isReadOnlySubmission}
                  placeholder="Select preferred time"
                  onChange={(value) => updateField("scheduledTime", value)}
                />
              </Field>
            </div>
            {guardRailError && (
              <div className="sub-inline-error">{guardRailError}</div>
            )}
          </section>

          {!isReadOnlySubmission && (
            <StepPanelActions activeStep={activeStep} onStepChange={setActiveStep} />
          )}
            </>
          )}
        </main>

        <aside className="sub-guard-panel">
          {isReadOnlySubmission ? (
            <SubmissionReviewPanel
              status={selectedStatus}
              form={form}
              user={user}
              scheduledAt={scheduledAt}
            />
          ) : lookupsLoading || hydratingId ? (
            <ReadinessSkeleton />
          ) : (
            <div className="sub-guard-header">
              <div className="sub-guard-title">
                <i className="ti ti-shield-check"></i> Readiness
              </div>
              <ReadinessRing score={readiness.score} />
              <div className="sub-score-grade">{readiness.grade}</div>
              <div className="sub-score-desc">{readiness.description}</div>
            </div>
          )}

          <GuardSection title="Required Fields" icon="ti-list-check">
            <CheckItem
              pass={Boolean(form.eventTitle.trim())}
              title="Event title"
              sub={form.eventTitle || "Required"}
            />
            <CheckItem
              pass={Boolean(form.eventDate)}
              title="Event date"
              sub={form.eventDate ? formatDate(form.eventDate) : "Required"}
            />
            <CheckItem
              pass={captionTone(form.caption) === "ok"}
              title="Caption length"
              sub={`${form.caption.length} characters`}
            />
            <CheckItem
              pass
              title="Event category"
              sub="Not required by backend UC-1.3"
            />
          </GuardSection>

          <GuardSection title="Media Quality" icon="ti-photo">
            <CheckItem
              pass
              idle={form.files.length === 0 && form.savedAssets.length === 0}
              title="Media attached"
              sub={
                form.files.length === 0 && form.savedAssets.length === 0
                  ? "Optional for text-only posts"
                  : `${form.savedAssets.length + form.files.length} file(s) attached`
              }
            />
            <CheckItem
              pass={form.files.every(
                (file) => file.size <= lookups.maxFileSizeMb * 1024 * 1024,
              )}
              title="All files within size limit"
              sub={`${lookups.maxFileSizeMb} MB max per file`}
            />
            <CheckItem
              pass={form.files.every((file) =>
                isAllowedFile(file, lookups.allowedFileTypes),
              )}
              title="Accepted file formats only"
              sub={
                lookups.allowedFileTypes.join(", ") || "Awaiting backend lookup"
              }
            />
          </GuardSection>

          <GuardSection title="Scheduling" icon="ti-calendar">
            <CheckItem
              pass={Boolean(scheduledAt)}
              title="Preferred slot selected"
              sub={
                scheduledAt
                  ? formatDateTime(scheduledAt)
                  : "Select date and time"
              }
            />
            {guardRailsLoading ? (
              <CheckItem
                pass
                idle
                title="Slot confirmation"
                sub="Checking preferred schedule..."
              />
            ) : guardRails ? (
              <CheckItem
                pass
                title="Slot confirmation"
                sub={
                  guardRails.clean
                    ? "Guardrails passed"
                    : `Testing override: ${guardRails.hardBlocks.length} issue(s) noted`
                }
              />
            ) : (
              <CheckItem
                pass
                idle
                title="Slot confirmation"
                sub="Testing override active"
              />
            )}
          </GuardSection>

          <div className="sub-fb-preview-wrap">
            <div className="sub-guard-section-title">
              <i className="ti ti-brand-facebook"></i> Facebook Preview
            </div>
            <div className="sub-fb-preview">
              <div className="sub-fb-preview-head">
                <div className="sub-fb-page-icon">
                  <i className="ti ti-brand-facebook"></i>
                </div>
                <div>
                  <div className="sub-fb-page-name">DASIG Facebook Page</div>
                  <div className="sub-fb-page-date">
                    {scheduledAt ? formatDate(scheduledAt) : "Unscheduled"}{" "}
                    <i className="ti ti-world"></i>
                  </div>
                </div>
              </div>
              <div className="sub-fb-preview-img">
                {mediaPreviewSrc(form, selectedFileIndex) ? (
                  <img
                    src={mediaPreviewSrc(form, selectedFileIndex)}
                    alt="Attached media preview"
                  />
                ) : (
                  <i className="ti ti-photo"></i>
                )}
              </div>
              <div className="sub-fb-preview-caption">{previewCaption}</div>
            </div>
          </div>

          <div className="sub-guard-actions">
            <button
              className="sub-guard-submit-btn"
              type="button"
              onClick={requestSubmitReview}
              disabled={busy || Boolean(hydratingId) || isReadOnlySubmission}
            >
              {submitting ? <i className="ti ti-loader-2 sub-spin"></i> : <i className="ti ti-send"></i>} Submit for Review
            </button>
            <button
              className="sub-guard-save-btn"
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || Boolean(hydratingId) || isReadOnlySubmission}
            >
              {saveState === "saving" ? <i className="ti ti-loader-2 sub-spin"></i> : <i className="ti ti-device-floppy"></i>} Save Draft
            </button>
          </div>
        </aside>
      </div>

      {modal === "submit" && (
        <ConfirmModal
          icon="ti-send"
          title="Submit for Review?"
          description={`This submission has the required title, event date, caption, and preferred schedule. Media is optional for text-only posts. It will be sent to your institution's Validator. Readiness score: ${readiness.score} / 100.`}
          cancelLabel="Go Back"
          confirmLabel="Confirm Submission"
          loading={submitting}
          disabled={busy}
          onCancel={() => setModal(null)}
          onConfirm={() => void handleSubmit()}
        />
      )}
      {modal === "success" && (
        <ConfirmModal
          icon="ti-circle-check"
          tone="success"
          title="Submission sent!"
          description="Your content has been submitted for validation. You will be notified when it is reviewed."
          confirmLabel="Done"
          onConfirm={() => setModal(null)}
        />
      )}
      {modal === "draft-choice" && (
        <ConfirmModal
          icon="ti-pencil"
          title="You have an unfinished draft"
          description="Resume the existing draft to keep working, or start a clean submission with empty media, details, schedule, and readiness state."
          cancelLabel="Resume Existing Draft"
          confirmLabel="Start New Submission"
          onCancel={resumeExistingDraft}
          onConfirm={startNewSubmission}
        />
      )}
      {modal === "draft-exit" && (
        <ConfirmModal
          icon="ti-notes"
          title="You are making a post"
          description="Do you want to save this post as a draft before leaving, or delete the draft and exit?"
          cancelLabel={deleting ? "Deleting..." : "Delete Draft"}
          confirmLabel={saveState === "saving" ? "Saving..." : "Save as Draft"}
          loading={saveState === "saving"}
          disabled={busy}
          onCancel={() => void handleDiscardDraftAndExit()}
          onConfirm={() => void handleSaveDraftAndExit()}
        />
      )}
      {modal === "delete" && (
        <ConfirmModal
          icon="ti-trash"
          tone="danger"
          title="Delete this draft?"
          description="This will delete the current draft from the submission queue."
          cancelLabel="Cancel"
          confirmLabel={deleting ? "Deleting..." : "Delete Draft"}
          loading={deleting}
          disabled={busy}
          onCancel={() => setModal(null)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </div>
  );
}

function StepProgress({
  steps,
  activeStep,
  onStepClick,
}: {
  steps: Array<{
    id: ProgressStep;
    label: string;
    complete: boolean;
  }>;
  activeStep: ProgressStep;
  onStepClick: (step: ProgressStep) => void;
}) {
  return (
    <div className="sub-step-nav" aria-label="Submission progress">
      {steps.map((step, index) => {
        const active = activeStep === step.id;
        return (
          <button
            key={step.id}
            className={`sub-step ${active ? "active" : ""} ${step.complete ? "complete" : ""}`}
            type="button"
            onClick={() => onStepClick(step.id)}
            aria-controls={`sub-step-${step.id}`}
          >
            <span className="sub-step-circle">
              {step.complete ? <i className="ti ti-check"></i> : index + 1}
            </span>
            <span className="sub-step-text">
              <span>Step {index + 1}</span>
              {step.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StepPanelActions({
  activeStep,
  onStepChange,
}: {
  activeStep: ProgressStep;
  onStepChange: (step: ProgressStep) => void;
}) {
  const order: ProgressStep[] = ["media", "details", "schedule"];
  const index = order.indexOf(activeStep);
  const previous = index > 0 ? order[index - 1] : null;
  const next = index < order.length - 1 ? order[index + 1] : null;

  return (
    <div className="sub-step-panel-actions">
      <button
        type="button"
        className="sub-step-panel-btn secondary"
        onClick={() => previous && onStepChange(previous)}
        disabled={!previous}
      >
        <i className="ti ti-arrow-left"></i> Previous
      </button>
      {next ? (
        <button
          type="button"
          className="sub-step-panel-btn primary"
          onClick={() => onStepChange(next)}
        >
          Next: {stepLabel(next)} <i className="ti ti-arrow-right"></i>
        </button>
      ) : (
        <span className="sub-step-panel-ready">
          <i className="ti ti-check"></i> Final step
        </span>
      )}
    </div>
  );
}

function CalendarDateField({
  value,
  placeholder,
  readOnly,
  onChange,
}: {
  value: string;
  placeholder: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  const selectedDate = parseInputDate(value);
  const [open, setOpen] = useState(false);
  const { rootRef, popoverRef, placement, maxHeight } =
    usePopoverCollision(open);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const base = selectedDate || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
      );
    }
  }, [value]);

  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const todayValue = dateToInputValue(new Date());
  const displayValue = selectedDate ? formatLongDate(value) : "";

  function moveMonth(offset: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function selectDate(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div
      className={`sub-date-field ${open ? "is-open" : ""} ${placement}`}
      ref={rootRef}
    >
      <button
        className={`sub-date-trigger ${open ? "open" : ""}`}
        type="button"
        disabled={readOnly}
        onClick={() => {
          if (!readOnly) setOpen((current) => !current);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={displayValue ? "" : "placeholder"}>
          {displayValue || placeholder}
        </span>
        <i className="ti ti-calendar-event"></i>
      </button>

      {open && !readOnly && (
        <div
          className="sub-date-popover"
          ref={popoverRef}
          role="dialog"
          aria-label={placeholder}
          style={{ maxHeight }}
        >
          <div className="sub-date-popover-head">
            <button
              type="button"
              className="sub-date-nav"
              onClick={() => moveMonth(-1)}
              aria-label="Previous month"
            >
              <i className="ti ti-chevron-left"></i>
            </button>
            <div>
              <div className="sub-date-month">
                {visibleMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div className="sub-date-hint">Pick a calendar date</div>
            </div>
            <button
              type="button"
              className="sub-date-nav"
              onClick={() => moveMonth(1)}
              aria-label="Next month"
            >
              <i className="ti ti-chevron-right"></i>
            </button>
          </div>

          <div className="sub-date-weekdays" aria-hidden="true">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="sub-date-grid">
            {days.map((day) => (
              <button
                key={day.value}
                className={[
                  "sub-date-day",
                  day.inMonth ? "" : "muted",
                  day.value === value ? "selected" : "",
                  day.value === todayValue ? "today" : "",
                ].join(" ")}
                type="button"
                onClick={() => selectDate(day.value)}
              >
                {day.date.getDate()}
              </button>
            ))}
          </div>

          <div className="sub-date-actions">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button type="button" onClick={() => selectDate(todayValue)}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimePickerField({
  value,
  placeholder,
  readOnly,
  onChange,
}: {
  value: string;
  placeholder: string;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { rootRef, popoverRef, placement, maxHeight } =
    usePopoverCollision(open);
  const [draft, setDraft] = useState(() => parseTimeValue(value));
  const displayValue = value ? formatTimeDisplay(value) : "";

  useEffect(() => {
    if (open) setDraft(parseTimeValue(value));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function adjust(part: "hour" | "minute", offset: number) {
    setDraft((current) => {
      if (part === "hour") {
        const next = cycleNumber(current.hour + offset, 1, 12);
        return { ...current, hour: next };
      }
      const next = cycleNumber(current.minute + offset, 0, 59);
      return { ...current, minute: next };
    });
  }

  function applyTime() {
    onChange(timePartsToValue(draft));
    setOpen(false);
  }

  return (
    <div
      className={`sub-time-field ${open ? "is-open" : ""} ${placement}`}
      ref={rootRef}
    >
      <button
        className={`sub-time-trigger ${open ? "open" : ""}`}
        type="button"
        disabled={readOnly}
        onClick={() => {
          if (!readOnly) setOpen((current) => !current);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={displayValue ? "" : "placeholder"}>
          {displayValue || placeholder}
        </span>
        <i className="ti ti-clock"></i>
      </button>

      {open && !readOnly && (
        <div
          className="sub-time-popover"
          ref={popoverRef}
          role="dialog"
          aria-label={placeholder}
          style={{ maxHeight }}
        >
          <div className="sub-time-head">
            <div>
              <div className="sub-time-title">Preferred time</div>
              <div className="sub-time-hint">Set the requested publish time</div>
            </div>
            <div className="sub-time-preview">
              {formatTimeParts(draft)}
            </div>
          </div>

          <div className="sub-time-controls">
            <TimeStepper
              label="Hour"
              value={String(draft.hour).padStart(2, "0")}
              onIncrement={() => adjust("hour", 1)}
              onDecrement={() => adjust("hour", -1)}
            />
            <TimeStepper
              label="Minute"
              value={String(draft.minute).padStart(2, "0")}
              onIncrement={() => adjust("minute", 1)}
              onDecrement={() => adjust("minute", -1)}
            />
            <div className="sub-time-period" aria-label="Meridiem">
              {(["AM", "PM"] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  className={draft.period === period ? "active" : ""}
                  onClick={() =>
                    setDraft((current) => ({ ...current, period }))
                  }
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="sub-time-quick">
            {[0, 15, 30, 45].map((minute) => (
              <button
                key={minute}
                type="button"
                className={draft.minute === minute ? "active" : ""}
                onClick={() =>
                  setDraft((current) => ({ ...current, minute }))
                }
              >
                :{String(minute).padStart(2, "0")}
              </button>
            ))}
          </div>

          <div className="sub-time-actions">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button type="button" onClick={applyTime}>
              Apply Time
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeStepper({
  label,
  value,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: string;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="sub-time-stepper">
      <button type="button" onClick={onIncrement} aria-label={`Increase ${label}`}>
        <i className="ti ti-chevron-up"></i>
      </button>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <button type="button" onClick={onDecrement} aria-label={`Decrease ${label}`}>
        <i className="ti ti-chevron-down"></i>
      </button>
    </div>
  );
}

function usePopoverCollision(open: boolean) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] =
    useState<PopoverPlacement>("drop-down");
  const [maxHeight, setMaxHeight] = useState(420);

  useEffect(() => {
    if (!open) return;

    let frame = 0;
    const viewportGap = 18;
    const triggerGap = 10;
    const minComfortHeight = 260;

    function updatePlacement() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const root = rootRef.current;
        const popover = popoverRef.current;
        if (!root || !popover) return;

        const rootRect = root.getBoundingClientRect();
        const naturalHeight = popover.scrollHeight;
        const spaceBelow =
          window.innerHeight - rootRect.bottom - triggerGap - viewportGap;
        const spaceAbove = rootRect.top - triggerGap - viewportGap;
        const shouldDropUp =
          spaceBelow < Math.min(naturalHeight, minComfortHeight) &&
          spaceAbove > spaceBelow;
        const availableSpace = shouldDropUp ? spaceAbove : spaceBelow;
        const safeHeight = Math.max(
          220,
          Math.min(naturalHeight, availableSpace),
        );

        setPlacement(shouldDropUp ? "drop-up" : "drop-down");
        setMaxHeight(safeHeight);
      });
    }

    updatePlacement();
    window.addEventListener("resize", updatePlacement);
    window.addEventListener("scroll", updatePlacement, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePlacement);
      window.removeEventListener("scroll", updatePlacement, true);
    };
  }, [open]);

  return { rootRef, popoverRef, placement, maxHeight };
}

function stepLabel(step: ProgressStep) {
  if (step === "media") return "Media Assets";
  if (step === "details") return "Post Details";
  return "Preferred Schedule";
}

function QueueSkeleton() {
  return (
    <div className="sub-queue-skeleton" aria-label="Loading submissions">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="sub-queue-skeleton-card" key={index}>
          <span className="sub-skel-line wide sub-shimmer"></span>
          <span className="sub-skel-line sub-shimmer"></span>
          <div className="sub-skel-thumbs">
            <span className="sub-skel-thumb sub-shimmer"></span>
            <span className="sub-skel-thumb sub-shimmer"></span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubmissionHydrationSkeleton() {
  return (
    <div className="sub-hydration-skeleton" aria-label="Loading draft">
      <span className="sub-skel-line title sub-shimmer"></span>
      <span className="sub-skel-block sub-shimmer"></span>
      <span className="sub-skel-line wide sub-shimmer"></span>
      <span className="sub-skel-line sub-shimmer"></span>
    </div>
  );
}

function ReadinessSkeleton() {
  return (
    <div className="sub-readiness-skeleton" aria-label="Loading readiness">
      <span className="sub-skel-ring sub-shimmer"></span>
      <span className="sub-skel-line wide sub-shimmer"></span>
      <span className="sub-skel-line sub-shimmer"></span>
    </div>
  );
}

function SubmissionReviewPanel({
  status,
  form,
  user,
  scheduledAt,
}: {
  status: SubmissionStatus | null;
  form: FormState;
  user: User;
  scheduledAt?: string;
}) {
  const mediaCount = form.savedAssets.length + form.files.length;

  return (
    <div className="sub-review-panel">
      <div className="sub-review-head">
        <div className="sub-review-icon">
          <i className="ti ti-eye-check"></i>
        </div>
        <div className="sub-review-title">Submitted Preview</div>
        <div className="sub-review-sub">
          {status ? statusLabels[status] : "Submitted"} content is read-only.
        </div>
      </div>

      <div className="sub-review-summary">
        <ReviewFact label="Title" value={form.eventTitle || "Untitled submission"} />
        <ReviewFact label="Institution" value={user.inst} />
        <ReviewFact label="Event Date" value={form.eventDate ? formatDate(form.eventDate) : "Not provided"} />
        <ReviewFact label="Schedule" value={scheduledAt ? formatDateTime(scheduledAt) : "Not scheduled"} />
        <ReviewFact label="Media" value={`${mediaCount} asset${mediaCount === 1 ? "" : "s"}`} />
      </div>
    </div>
  );
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="sub-review-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SectionHead({
  icon,
  tone,
  title,
  subtitle,
}: {
  icon: string;
  tone: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="sub-section-head">
      <div className="sub-section-label">
        <div className={`sub-section-icon ${tone}`}>
          <i className={`ti ${icon}`}></i>
        </div>
        <div>
          <div className="sub-section-title">{title}</div>
          <div className="sub-section-subtitle">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  count,
  tone,
  children,
}: {
  label: string;
  count?: string;
  tone?: string;
  children: ReactNode;
}) {
  return (
    <label className="sub-fgroup">
      <span className="sub-flabel">
        {label}
        {count && (
          <span className={`sub-flabel-count ${tone || ""}`}>{count}</span>
        )}
      </span>
      {children}
    </label>
  );
}

function GuardSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div className="sub-guard-section">
      <div className="sub-guard-section-title">
        <i className={`ti ${icon}`}></i> {title}
      </div>
      {children}
    </div>
  );
}

function CheckItem({
  pass,
  idle,
  title,
  sub,
}: {
  pass: boolean;
  idle?: boolean;
  title: string;
  sub: string;
}) {
  return (
    <div className="sub-check-item">
      <div
        className={`sub-check-icon ${idle ? "idle" : pass ? "pass" : "warn"}`}
      >
        <i
          className={`ti ${idle ? "ti-clock" : pass ? "ti-check" : "ti-alert-triangle"}`}
        ></i>
      </div>
      <div>
        <div className="sub-check-title">{title}</div>
        <div className="sub-check-sub">{sub}</div>
      </div>
    </div>
  );
}

function QueueState({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="sub-queue-state">
      <i className={`ti ${icon}`}></i>
      <span>{title}</span>
      {description && <small>{description}</small>}
    </div>
  );
}

function ReadinessRing({ score }: { score: number }) {
  const circumference = 175.9;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="sub-score-ring">
      <svg viewBox="0 0 64 64">
        <circle className="sub-score-bg" cx="32" cy="32" r="28" />
        <circle
          className="sub-score-fill"
          cx="32"
          cy="32"
          r="28"
          style={{
            strokeDashoffset: offset,
            stroke:
              score >= 80 ? "#16A34A" : score >= 60 ? "#D97706" : "#DC2626",
          }}
        />
      </svg>
      <div
        className="sub-score-num"
        style={{
          color: score >= 80 ? "#16A34A" : score >= 60 ? "#D97706" : "#DC2626",
        }}
      >
        {score}
      </div>
    </div>
  );
}

function ConfirmModal({
  icon,
  tone = "info",
  title,
  description,
  cancelLabel,
  confirmLabel,
  loading = false,
  disabled = false,
  onCancel,
  onConfirm,
}: {
  icon: string;
  tone?: "info" | "success" | "danger";
  title: string;
  description: string;
  cancelLabel?: string;
  confirmLabel: string;
  loading?: boolean;
  disabled?: boolean;
  onCancel?: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="sub-modal-overlay"
      onClick={disabled ? undefined : onCancel || onConfirm}
    >
      <div className="sub-modal" onClick={(event) => event.stopPropagation()}>
        <div className={`sub-modal-icon ${tone}`}>
          <i className={`ti ${icon}`}></i>
        </div>
        <div className="sub-modal-title">{title}</div>
        <div className="sub-modal-desc">{description}</div>
        <div className="sub-modal-actions">
          {onCancel && (
            <button
              className="sub-modal-btn cancel"
              type="button"
              onClick={onCancel}
              disabled={disabled}
            >
              {cancelLabel}
            </button>
          )}
          <button
            className={`sub-modal-btn ${tone}`}
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            aria-busy={loading}
          >
            {loading && <i className="ti ti-loader-2 sub-spin"></i>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2L22 7V17L12 22L2 17V7L12 2Z" />
    </svg>
  );
}

function toPayload(form: FormState, scheduledAt?: string): SubmissionPayload {
  return {
    eventTitle: form.eventTitle.trim() || "Untitled submission",
    eventDate: form.eventDate || new Date().toISOString().slice(0, 10),
    caption: form.caption.trim(),
    description: form.description.trim(),
    scheduledAt,
    category: form.category || undefined,
    tags: form.tags.length > 0 ? form.tags : undefined,
  };
}

function getSubmitBlockers(
  form: FormState,
  scheduledAt: string | undefined,
  allowedFileTypes: string[],
  maxFileSizeMb: number,
): SubmitBlocker[] {
  const blockers: SubmitBlocker[] = [];
  if (
    form.files.some((file) => file.size > maxFileSizeMb * 1024 * 1024)
  ) {
    blockers.push({ label: "media within file size limit", step: "media" });
  }
  if (
    form.files.some((file) => !isAllowedFile(file, allowedFileTypes))
  ) {
    blockers.push({ label: "accepted media file formats", step: "media" });
  }
  if (!form.eventTitle.trim()) {
    blockers.push({ label: "event title", step: "details" });
  }
  if (!form.eventDate) {
    blockers.push({ label: "event date", step: "details" });
  }
  if (!form.caption.trim()) {
    blockers.push({ label: "caption", step: "details" });
  }
  if (!scheduledAt) {
    blockers.push({ label: "preferred schedule date and time", step: "schedule" });
  }

  return blockers;
}

function isDirtyDraft(form: FormState) {
  return Boolean(
    form.id ||
      form.eventTitle.trim() ||
      form.eventDate ||
      form.caption.trim() ||
      form.description.trim() ||
      form.category ||
      form.scheduledDate ||
      form.scheduledTime ||
      form.tags.length ||
      form.files.length ||
      form.savedAssets.length,
  );
}

function upsertSubmission(items: SubmissionSummary[], next: SubmissionSummary) {
  const exists = items.some((item) => item.id === next.id);
  if (!exists) return [next, ...items];
  return items.map((item) => (item.id === next.id ? next : item));
}

function calculateReadiness(
  form: FormState,
  guardRails: GuardRailResult | null,
) {
  let score = 0;
  if (form.eventTitle.trim()) score += 15;
  if (form.eventDate) score += 15;
  if (captionTone(form.caption) === "ok") score += 20;
  if (form.files.length > 0 || form.savedAssets.length > 0) score += 20;
  if (form.scheduledDate && form.scheduledTime) score += 10;
  if (guardRails && !guardRails.blocked) score += 10;

  return {
    score,
    grade:
      score >= 80
        ? "Good to submit"
        : score >= 60
          ? "Needs attention"
          : "Incomplete",
    description:
      score >= 80
        ? "Most checks pass. Non-blocking warnings can still be reviewed."
        : score >= 60
          ? "Resolve the highlighted items before sending."
          : "Complete the required fields to prepare this submission.",
  };
}

function captionTone(caption: string) {
  if (caption.length >= 150 && caption.length <= 500) return "ok";
  if (caption.length === 0) return "";
  return "warn";
}

const previewUrls = new WeakMap<File, string>();

function filePreviewUrl(file: File) {
  const existing = previewUrls.get(file);
  if (existing) return existing;
  const next = URL.createObjectURL(file);
  previewUrls.set(file, next);
  return next;
}

function mediaPreviewSrc(form: FormState, selectedFileIndex: number) {
  const selectedFile = form.files[selectedFileIndex];
  if (selectedFile?.type.startsWith("image/")) {
    return filePreviewUrl(selectedFile);
  }
  const imageAsset =
    form.savedAssets[selectedFileIndex] ||
    form.savedAssets.find((asset) =>
      ["image", "jpeg", "jpg", "png", "webp", "gif"].some((type) =>
        asset.fileType.toLowerCase().startsWith(type),
      ),
    );
  if (!imageAsset) return "";
  const fileType = imageAsset.fileType.toLowerCase();
  return ["image", "jpeg", "jpg", "png", "webp", "gif"].some((type) =>
    fileType.startsWith(type),
  )
    ? imageAsset.storageUrl
    : "";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatLongDate(value: string) {
  const date = parseInputDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTimeDisplay(value: string) {
  const parts = parseTimeValue(value);
  return formatTimeParts(parts);
}

function formatTimeParts(parts: { hour: number; minute: number; period: "AM" | "PM" }) {
  return `${parts.hour}:${String(parts.minute).padStart(2, "0")} ${parts.period}`;
}

function parseTimeValue(value: string) {
  if (!value) {
    const now = new Date();
    return toTimeParts(now.getHours(), now.getMinutes());
  }
  const [hourPart, minutePart] = value.split(":").map(Number);
  if (Number.isNaN(hourPart) || Number.isNaN(minutePart)) {
    const now = new Date();
    return toTimeParts(now.getHours(), now.getMinutes());
  }
  return toTimeParts(hourPart, minutePart);
}

function toTimeParts(hour24: number, minute: number) {
  const period: "AM" | "PM" = hour24 >= 12 ? "PM" : "AM";
  const hour = hour24 % 12 || 12;
  return {
    hour,
    minute: Math.min(Math.max(minute, 0), 59),
    period,
  };
}

function timePartsToValue(parts: {
  hour: number;
  minute: number;
  period: "AM" | "PM";
}) {
  const hour24 =
    parts.period === "PM"
      ? parts.hour === 12
        ? 12
        : parts.hour + 12
      : parts.hour === 12
        ? 0
        : parts.hour;
  return `${String(hour24).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

function cycleNumber(value: number, min: number, max: number) {
  if (value > max) return min;
  if (value < min) return max;
  return value;
}

function parseInputDate(value: string) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function dateToInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function buildCalendarDays(monthDate: Date) {
  const firstOfMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1,
  );
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      value: dateToInputValue(date),
      inMonth: date.getMonth() === monthDate.getMonth(),
    };
  });
}

function formatTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function formatRole(role: User["role"]) {
  if (role === "admin") return "Administrator";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function isAllowedFile(file: File, allowedFileTypes: string[]) {
  if (allowedFileTypes.length === 0) return true;
  const extension = normalizeFileType(
    file.name.split(".").pop()?.toLowerCase() || "",
  );
  return Boolean(extension && allowedFileTypes.includes(extension));
}

function normalizeFileType(fileType: string) {
  return fileType === "jpg" ? "jpeg" : fileType;
}
