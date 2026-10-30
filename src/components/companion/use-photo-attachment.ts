"use client";

import { useEffect, useRef, useState } from "react";

import { updateAIConsents } from "@/lib/api-client/ai";
import { uploadMedia } from "@/lib/api-client/media";
import { ApiRequestError } from "@/lib/api-client/request";
import { shrinkImage } from "@/lib/utils/image-edit";

// One photo for the next question (F-24, AIC-05): checked, consent asked the first time, uploaded
// at once as purpose `ai`, and sent with the message. A photo over the 10 MB upload limit is
// shrunk in the browser first; the server scales it again before it goes to the provider.

export const PHOTO_TYPES = "image/jpeg,image/png,image/webp";
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type PhotoAttachment = { mediaId: string; previewUrl: string };

export function usePhotoAttachment({
  hasConsent: initialConsent,
  onError,
}: {
  hasConsent: boolean;
  onError: (message: string) => void;
}) {
  const [hasConsent, setHasConsent] = useState(initialConsent);
  const [photo, setPhoto] = useState<PhotoAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // A chosen file waiting for the member's answer to the consent notice.
  const [waitingFile, setWaitingFile] = useState<File | null>(null);
  const previewRef = useRef<string | null>(null);

  // Preview addresses are released when the photo is replaced, removed or the chat closes.
  useEffect(() => {
    previewRef.current = photo?.previewUrl ?? null;
  }, [photo]);
  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  function discard() {
    setPhoto((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }

  async function upload(file: File) {
    setIsUploading(true);
    const previewUrl = URL.createObjectURL(file);
    try {
      const ready = file.size > MAX_PHOTO_BYTES ? await shrinkImage(file) : file;
      const media = await uploadMedia(ready, { purpose: "ai" });
      discard();
      setPhoto({ mediaId: media.id, previewUrl });
    } catch (caught) {
      URL.revokeObjectURL(previewUrl);
      onError(
        caught instanceof ApiRequestError
          ? caught.message
          : "We couldn't use that photo. Try another one.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  function choose(file: File) {
    if (!PHOTO_TYPES.split(",").includes(file.type)) {
      onError("Choose a JPEG, PNG or WebP photo.");
      return;
    }
    if (hasConsent) void upload(file);
    else setWaitingFile(file);
  }

  async function answerConsent(allow: boolean) {
    const file = waitingFile;
    setWaitingFile(null);
    if (!allow || !file) return;
    try {
      await updateAIConsents({ AI_IMAGES: true });
    } catch (caught) {
      onError(
        caught instanceof ApiRequestError ? caught.message : "We couldn't save that. Try again.",
      );
      return;
    }
    setHasConsent(true);
    void upload(file);
  }

  return {
    photo,
    isUploading,
    isAskingConsent: waitingFile !== null,
    choose,
    answerConsent,
    /** Takes the photo off the next question. */
    remove: discard,
    /** After a sent message the photo belongs to the chat, so only the preview is released. */
    clear: discard,
    /** The server says consent is missing (it was withdrawn elsewhere): ask again next time. */
    forgetConsent: () => setHasConsent(false),
  };
}
