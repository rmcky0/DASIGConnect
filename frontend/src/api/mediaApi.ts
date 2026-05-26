import { api } from "./authApi";

export type MediaAssetStatus = "processing" | "ready" | "error";

export interface AiTag {
  label: string;
  confidence: number;
}

export interface MediaUsage {
  submissionId: string;
  submissionTitle: string;
  submittedAt: string;
  submissionStatus: string;
  deepLink?: string;
}

export interface MediaAsset {
  id: string;
  code: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  storageUrl: string;
  institutionId: string;
  institutionName?: string;
  uploaderName?: string;
  uploadedAt: string;
  status: MediaAssetStatus;
  aiTags?: AiTag[];
  usedIn?: MediaUsage[];
  widthPx?: number;
  heightPx?: number;
  durationSeconds?: number;
}

export interface DeleteCheckResult {
  tier: "blocked" | "warning" | "free";
  blockingUsages: MediaUsage[];
  warningUsages: MediaUsage[];
}

export interface MediaAssetUploadUrlRequest {
  fileName: string;
  fileType: string;
}

export interface MediaAssetUploadUrlResponse {
  signedUrl: string;
  publicUrl: string;
  path: string;
}

export interface MediaAssetRegisterRequest {
  storageUrl: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
}

interface MediaAssetPageResponse {
  items: Array<{
    id: string;
    assetCode: string;
    storageUrl: string;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    aiCategory?: string | null;
    createdAt: string;
  }>;
  totalCount: number;
}

export function listMediaAssets(params?: { networkView?: boolean }, signal?: AbortSignal) {
  const scope = params?.networkView ? "network" : undefined;
  return api
    .get<MediaAssetPageResponse>("/media-assets", {
      params: scope ? { scope } : undefined,
      signal,
    })
    .then((response) => ({
      ...response,
      data: (response.data.items ?? []).map((raw) => ({
        id: raw.id,
        code: raw.assetCode,
        title: raw.fileName,
        fileName: raw.fileName,
        fileType: raw.fileType,
        fileSizeBytes: raw.fileSizeBytes,
        storageUrl: raw.storageUrl,
        institutionId: "",
        uploadedAt: raw.createdAt,
        status: "ready" as const,
        aiTags: raw.aiCategory ? [{ label: raw.aiCategory, confidence: 100 }] : [],
      })),
    }));
}

interface MediaAssetDetailResponse {
  id: string;
  assetCode: string;
  storageUrl: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  aiCategory?: string | null;
  aiConfidence?: number | null;
  createdAt: string;
  uploaderEmail?: string | null;
  usedIn?: Array<{
    submissionId: string;
    eventTitle: string;
    submittedAt: string;
    status: string;
    deepLink?: string;
  }>;
  tags?: Array<{ id: string; label: string }>;
}

function mapDetailToAsset(raw: MediaAssetDetailResponse): MediaAsset {
  const aiTags: AiTag[] = [];
  if (raw.aiCategory) {
    aiTags.push({
      label: raw.aiCategory,
      confidence: raw.aiConfidence != null ? Math.round(Number(raw.aiConfidence) * 100) : 100,
    });
  }
  for (const tag of raw.tags ?? []) {
    if (!aiTags.some((t) => t.label === tag.label)) {
      aiTags.push({ label: tag.label, confidence: 100 });
    }
  }
  return {
    id: raw.id,
    code: raw.assetCode,
    title: raw.fileName,
    fileName: raw.fileName,
    fileType: raw.fileType,
    fileSizeBytes: raw.fileSizeBytes,
    storageUrl: raw.storageUrl,
    institutionId: "",
    uploaderName: raw.uploaderEmail ?? undefined,
    uploadedAt: raw.createdAt,
    status: "ready",
    aiTags: aiTags.length > 0 ? aiTags : undefined,
    usedIn: (raw.usedIn ?? []).map((u) => ({
      submissionId: u.submissionId,
      submissionTitle: u.eventTitle,
      submittedAt: u.submittedAt,
      submissionStatus: u.status,
      deepLink: u.deepLink,
    })),
  };
}

export function getMediaAsset(id: string, signal?: AbortSignal) {
  return api
    .get<MediaAssetDetailResponse>(`/media-assets/${id}`, { signal })
    .then((res) => ({ ...res, data: mapDetailToAsset(res.data) }));
}

export function deleteMediaAsset(id: string, force = false) {
  return api.delete<void>(`/media-assets/${id}`, { params: force ? { force: true } : undefined });
}

export function getMediaAssetUploadUrl(payload: MediaAssetUploadUrlRequest) {
  return api.post<MediaAssetUploadUrlResponse>("/media-assets/upload-url", payload);
}

export function registerMediaAsset(payload: MediaAssetRegisterRequest) {
  return api.post<MediaAsset>("/media-assets/upload", payload);
}
