import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaPlus, FaPlayCircle, FaImage, FaEdit, FaTrash, FaTimes, FaFileAlt, FaShareAlt, FaWhatsapp, FaFacebookF, FaTwitter, FaLinkedinIn, FaTelegramPlane, FaEnvelope, FaLink } from "react-icons/fa";
import { toast } from "react-toastify";
import { useMyContext } from "../Context/MyContext";
const EMPTY_ITEMS = [];
const PHOTO_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 50 * 1024 * 1024;
const VIDEO_DURATION_LIMIT = 180;
const MORE_ROWS = 3;
const INPUT_CLASS = "w-full rounded-xl border border-[#C9F5DC] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]";
const BUTTON_CLASS = "inline-flex items-center justify-center gap-2 rounded-full bg-[#065F2F] px-5 py-3 font-bold text-white transition hover:bg-[#0B7A3E] disabled:cursor-not-allowed disabled:opacity-60";
const CATEGORIES = [{
  label: "Activities",
  value: "activities"
}, {
  label: "Events",
  value: "events"
}, {
  label: "Skills & Empowerment",
  value: "empowerment"
}, {
  label: "Sports & Recreation",
  value: "sports"
}, {
  label: "Community Projects",
  value: "community"
}, {
  label: "Leadership",
  value: "leadership"
}];
const SHARE_PLATFORMS = [{
  key: "whatsapp",
  label: "WhatsApp",
  Icon: FaWhatsapp
}, {
  key: "facebook",
  label: "Facebook",
  Icon: FaFacebookF
}, {
  key: "twitter",
  label: "X",
  Icon: FaTwitter
}, {
  key: "linkedin",
  label: "LinkedIn",
  Icon: FaLinkedinIn
}, {
  key: "telegram",
  label: "Telegram",
  Icon: FaTelegramPlane
}, {
  key: "email",
  label: "Email",
  Icon: FaEnvelope
}];
const initialForm = () => ({
  title: "",
  description: "",
  category: "activities",
  mediaType: "photo",
  mediaUrl: "",
  thumbnailUrl: "",
  source: "CYC Jenta Adamu Ward",
  status: "published"
});
const mediaTypeOf = item => {
  if (item.mediaType === "video" || item.mediaType === "text") {
    return item.mediaType;
  }
  return "photo";
};
const categoryTitle = value => CATEGORIES.find(item => item.value === value)?.label || value || "Activities";
const validateFile = (file, thumbnail = false) => {
  const photo = file.type.startsWith("image/");
  const video = file.type.startsWith("video/");
  if (!photo && !video || thumbnail && !photo) {
    throw new Error(thumbnail ? "Please choose an image for the thumbnail." : "Please choose an image or video file.");
  }
  if (photo && file.size > PHOTO_LIMIT) {
    throw new Error("Pictures must be 10MB or smaller.");
  }
  if (video && file.size > VIDEO_LIMIT) {
    throw new Error("Videos must be 50MB or smaller.");
  }
  return video ? "video" : "photo";
};
const readVideoDuration = (file, signal) => new Promise((resolve, reject) => {
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  let finished = false;
  let timeout;
  const finish = (error, duration) => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timeout);
    signal.removeEventListener("abort", onAbort);
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
    if (error) {
      reject(error);
    } else {
      resolve(duration);
    }
  };
  const onAbort = () => {
    const error = new Error("Video check cancelled.");
    error.name = "AbortError";
    finish(error);
  };
  video.preload = "metadata";
  video.onloadedmetadata = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      finish(new Error("We couldn't read this video's duration. Please choose another file."));
    } else if (video.duration > VIDEO_DURATION_LIMIT) {
      finish(new Error("Videos must not exceed 3 minutes."));
    } else {
      finish(null, video.duration);
    }
  };
  video.onerror = () => finish(new Error("This video could not be read. Please choose another file."));
  signal.addEventListener("abort", onAbort, {
    once: true
  });
  if (signal.aborted) {
    onAbort();
    return;
  }
  timeout = window.setTimeout(() => finish(new Error("The video check took too long. Please try another file.")), 15000);
  video.src = url;
});
const videoThumbnail = item => {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  try {
    const url = new URL(item.mediaUrl);
    if (url.hostname !== "res.cloudinary.com" || !url.pathname.includes("/video/upload/")) {
      return "";
    }
    url.pathname = url.pathname.replace("/video/upload/", "/video/upload/so_0,f_jpg/").replace(/\.[^/.]+$/, ".jpg");
    return url.toString();
  } catch {
    return "";
  }
};
const shareImage = item => mediaTypeOf(item) === "photo" ? item.mediaUrl || "" : mediaTypeOf(item) === "video" ? videoThumbnail(item) : "";
const formatAddedTime = value => {
  if (!value) return "Just added";
  const date = typeof value.toDate === "function" ? value.toDate() : typeof value.seconds === "number" ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  });
};
const getShareUrl = item => {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("gallery", item.id);
  url.hash = "gallery";
  return url.toString();
};
const getShareText = item => {
  const description = String(item.description || "").replace(/\s+/g, " ").trim();
  return [item.title || "CYC Gallery", description.length > 170 ? `${description.slice(0, 167)}…` : description].filter(Boolean).join("\n\n");
};
const FormField = ({
  label,
  id,
  children,
  className = ""
}) => <div className={className}>
    <label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-700">
      {label}
    </label>
    {children}
  </div>;
const GalleryDialog = ({
  title,
  onClose,
  children,
  share = false
}) => {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector("button")?.focus();
    const keyDown = event => {
      if (event.key === "Escape") {
        closeRef.current();
      }
      if (event.key !== "Tab" || !dialog) return;
      const elements = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], video[controls], [tabindex="0"]'));
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keyDown);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);
  return <div onClick={event => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }} className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto bg-black/80 px-4 py-6">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="gallery-dialog-title" className={`my-auto max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white shadow-2xl ${share ? "max-w-lg" : "max-w-5xl"}`}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#C9F5DC] bg-white p-5">
          <h3 id="gallery-dialog-title" className="text-xl font-extrabold text-[#065F2F] md:text-2xl">
            {title}
          </h3>
          <button type="button" aria-label="Close gallery dialog" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E9FFF3] text-[#065F2F]">
            <FaTimes />
          </button>
        </div>
        <div className="p-5 md:p-7">{children}</div>
      </div>
    </div>;
};
const Gallery = () => {
  const {
    currentUser,
    canEditContribution,
    gallery = EMPTY_ITEMS,
    addGalleryItem,
    updateGalleryItem,
    deleteGalleryItem,
    loading,
    profileLoading,
    listenerErrors = {}
  } = useMyContext();
  const [category, setCategory] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [cardsPerRow, setCardsPerRow] = useState(2);
  const [visibleCount, setVisibleCount] = useState(2);
  const canContribute = Boolean(currentUser?.uid);
  const canEdit = item => canEditContribution(item);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [mediaFile, setMediaFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [checkingVideo, setCheckingVideo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [modal, setModal] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [preparedShareFile, setPreparedShareFile] = useState(null);
  const [failedImages, setFailedImages] = useState([]);
  const formRef = useRef(null);
  const mediaInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const objectUrlsRef = useRef(new Set());
  const uploadCacheRef = useRef({
    media: null,
    thumbnail: null
  });
  const xhrRef = useRef(null);
  const probeRef = useRef(null);
  const selectionRef = useRef(0);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const sharedRequestRef = useRef("");
  const shareBusyRef = useRef(false);
  const accessRef = useRef(null);
  accessRef.current = {
    allowed: canContribute,
    uid: currentUser?.uid
  };
  const busy = submitting || Boolean(deletingId);
  const items = useMemo(() => gallery.filter(item => canEditContribution(item) || item.status === "published"), [gallery, canEditContribution]);
  const filteredItems = useMemo(() => items.filter(item => (category === "all" || (item.category || "activities") === category) && (typeFilter === "all" || mediaTypeOf(item) === typeFilter)), [items, category, typeFilter]);
  const displayedItems = filteredItems.slice(0, visibleCount);
  const activeItem = modal ? items.find(item => item.id === modal.id) : null;
  const shareUrl = activeItem?.status === "published" ? getShareUrl(activeItem) : "";
  const activeShareImage = activeItem ? shareImage(activeItem) : "";
  useEffect(() => {
    mountedRef.current = true;
    const urls = objectUrlsRef.current;
    return () => {
      mountedRef.current = false;
      xhrRef.current?.abort();
      probeRef.current?.abort();
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);
  useEffect(() => {
    const update = () => {
      const next = window.innerWidth >= 1024 ? 3 : 2;
      setCardsPerRow(next);
      setVisibleCount(previous => Math.max(next, previous));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  useEffect(() => {
    xhrRef.current?.abort();
    probeRef.current?.abort();
    setShowForm(false);
  }, [currentUser?.uid]);
  useEffect(() => {
    const openRequestedItem = () => {
      const id = new URLSearchParams(window.location.search).get("gallery");
      if (!id || sharedRequestRef.current === id) return;
      const index = items.findIndex(item => item.id === id && item.status === "published");
      if (index < 0) return;
      sharedRequestRef.current = id;
      setCategory("all");
      setTypeFilter("all");
      setVisibleCount(previous => Math.max(previous, index + 1));
      setModal({
        kind: "preview",
        id,
        play: false
      });
    };
    openRequestedItem();
    window.addEventListener("popstate", openRequestedItem);
    return () => window.removeEventListener("popstate", openRequestedItem);
  }, [items]);
  useEffect(() => {
    setPreparedShareFile(null);
    if (modal?.kind !== "share" || !activeItem || activeItem.status !== "published" || !activeShareImage || typeof File === "undefined") {
      return undefined;
    }
    const controller = new AbortController();
    const id = activeItem.id;
    const prepare = async () => {
      try {
        const response = await fetch(activeShareImage, {
          mode: "cors",
          signal: controller.signal
        });
        if (!response.ok) return;
        const blob = await response.blob();
        if (!blob.type.startsWith("image/") || blob.size > PHOTO_LIMIT) {
          return;
        }
        const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
        const file = new File([blob], `cyc-gallery-${id}.${extension}`, {
          type: blob.type
        });
        if (!controller.signal.aborted) {
          setPreparedShareFile({
            id,
            file
          });
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.warn("Gallery share picture:", error);
        }
      }
    };
    prepare();
    return () => controller.abort();
  }, [modal?.kind, activeItem?.id, activeItem?.status, activeShareImage]);
  const scrollTo = element => {
    if (!element) return;
    const headerHeight = document.querySelector("header")?.getBoundingClientRect().height || 120;
    window.scrollTo({
      top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - headerHeight - 16),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
    });
  };
  const releaseUrl = url => {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  };
  const resetForm = () => {
    selectionRef.current += 1;
    probeRef.current?.abort();
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
    uploadCacheRef.current = {
      media: null,
      thumbnail: null
    };
    setForm(initialForm());
    setEditingItem(null);
    setMediaFile(null);
    setThumbnailFile(null);
    setMediaPreview("");
    setThumbnailPreview("");
    setCheckingVideo(false);
    setUploadProgress(0);
    setStage("");
    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }
    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = "";
    }
  };
  const closeForm = () => {
    if (busyRef.current) return;
    resetForm();
    setShowForm(false);
  };
  const openForm = (item = null) => {
    if (!canContribute || busyRef.current || item && !canEdit(item)) return;
    resetForm();
    if (item) {
      setEditingItem(item);
      setForm({
        title: item.title || "",
        description: item.description || "",
        category: item.category || "activities",
        mediaType: mediaTypeOf(item),
        mediaUrl: item.mediaUrl || "",
        thumbnailUrl: item.thumbnailUrl || "",
        source: item.source || "",
        status: item.status === "published" ? "published" : "draft"
      });
    }
    setShowForm(true);
    window.requestAnimationFrame(() => scrollTo(formRef.current));
  };
  const changeField = (name, value) => {
    setForm(previous => ({
      ...previous,
      [name]: value
    }));
  };
  const clearThumbnail = () => {
    releaseUrl(thumbnailPreview);
    setThumbnailPreview("");
    setThumbnailFile(null);
    uploadCacheRef.current.thumbnail = null;
    setForm(previous => ({
      ...previous,
      thumbnailUrl: ""
    }));
  };
  const changeType = type => {
    if (type === form.mediaType) return;
    selectionRef.current += 1;
    probeRef.current?.abort();
    releaseUrl(mediaPreview);
    setMediaFile(null);
    setMediaPreview("");
    setCheckingVideo(false);
    uploadCacheRef.current.media = null;
    clearThumbnail();
    setForm(previous => ({
      ...previous,
      mediaType: type,
      mediaUrl: "",
      thumbnailUrl: ""
    }));
  };
  const selectMedia = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busyRef.current) return;
    const token = ++selectionRef.current;
    probeRef.current?.abort();
    try {
      const type = validateFile(file);
      if (type === "video") {
        setCheckingVideo(true);
        const controller = new AbortController();
        probeRef.current = controller;
        await readVideoDuration(file, controller.signal);
      }
      if (!mountedRef.current || token !== selectionRef.current) {
        return;
      }
      releaseUrl(mediaPreview);
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      setMediaFile(file);
      setMediaPreview(url);
      uploadCacheRef.current.media = null;
      if (type !== form.mediaType) {
        clearThumbnail();
      }
      setForm(previous => ({
        ...previous,
        mediaType: type,
        mediaUrl: "",
        thumbnailUrl: type === previous.mediaType ? previous.thumbnailUrl : ""
      }));
    } catch (error) {
      if (mountedRef.current && token === selectionRef.current && error.name !== "AbortError") {
        toast.error(error.message);
      }
    } finally {
      if (mountedRef.current && token === selectionRef.current) {
        setCheckingVideo(false);
      }
    }
  };
  const selectThumbnail = event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busyRef.current) return;
    try {
      validateFile(file, true);
      releaseUrl(thumbnailPreview);
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      setThumbnailFile(file);
      setThumbnailPreview(url);
      uploadCacheRef.current.thumbnail = null;
    } catch (error) {
      toast.error(error.message);
    }
  };
  const uploadFile = (file, folder) => new Promise((resolve, reject) => {
    const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) {
      console.error("CYC gallery: Cloudinary configuration missing.");
      reject(new Error("Uploads are not configured yet. Please contact the site administrator."));
      return;
    }
    const type = file.type.startsWith("video/") ? "video" : "image";
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", preset);
    body.append("folder", `cyc/jenta-adamu-ward/gallery/${folder}`);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${type}/upload`);
    xhr.timeout = 300000;
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && mountedRef.current) {
        setUploadProgress(Math.round(event.loaded / event.total * 100));
      }
    };
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && result.secure_url) {
          resolve(result.secure_url);
        } else {
          console.error("CYC gallery upload:", result?.error?.message);
          reject(new Error("This file could not be uploaded. Please try again."));
        }
      } catch (error) {
        console.error("Gallery upload response:", error);
        reject(new Error("The upload did not finish correctly. Please try again."));
      }
    };
    xhr.onerror = () => reject(new Error("Please check your connection and retry the upload."));
    xhr.onabort = () => reject(new Error("The upload was interrupted."));
    xhr.ontimeout = () => reject(new Error("The upload took too long. Please try a stronger connection."));
    xhr.onloadend = () => {
      if (xhrRef.current === xhr) {
        xhrRef.current = null;
      }
    };
    xhr.send(body);
  });
  const assertAccess = uid => {
    if (!mountedRef.current || !accessRef.current?.allowed || accessRef.current.uid !== uid) {
      throw new Error("Your session has changed. Please sign in again.");
    }
  };
  const handleSubmit = async event => {
    event.preventDefault();
    if (busyRef.current || checkingVideo) return;
    if (!currentUser || !canContribute) {
      toast.error("Please sign in to add photographs, videos or stories.");
      return;
    }
    const textOnly = form.mediaType === "text";
    if (!form.title.trim() || !form.category) {
      toast.error("Please enter a title and category.");
      return;
    }
    if (textOnly && !form.description.trim()) {
      toast.error("Please enter the story text.");
      return;
    }
    if (!textOnly && !mediaFile && !form.mediaUrl) {
      toast.error("Please select a photograph or video.");
      return;
    }
    busyRef.current = true;
    setSubmitting(true);
    const uid = currentUser.uid;
    let uploading = false;
    try {
      assertAccess(uid);
      let mediaUrl = form.mediaUrl;
      let thumbnailUrl = form.mediaType === "video" ? form.thumbnailUrl : "";
      for (const [key, file, folder] of [["media", !textOnly ? mediaFile : null, form.mediaType], ["thumbnail", form.mediaType === "video" ? thumbnailFile : null, "thumbnails"]]) {
        if (!file) continue;
        assertAccess(uid);
        validateFile(file, key === "thumbnail");
        const cached = uploadCacheRef.current[key];
        let url = cached?.file === file ? cached.url : "";
        if (!url) {
          uploading = true;
          setStage(key === "thumbnail" ? "Uploading thumbnail" : "Uploading gallery file");
          setUploadProgress(0);
          url = await uploadFile(file, folder);
          uploadCacheRef.current[key] = {
            file,
            url
          };
          uploading = false;
        }
        if (key === "media") {
          mediaUrl = url;
        } else {
          thumbnailUrl = url;
        }
      }
      assertAccess(uid);
      setStage("Saving gallery item");
      const sameExistingType = editingItem && mediaTypeOf(editingItem) === form.mediaType;
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        mediaType: form.mediaType,
        mediaUrl: textOnly ? "" : mediaUrl,
        thumbnailUrl: textOnly ? "" : thumbnailUrl,
        source: form.source.trim(),
        status: form.status === "published" ? "published" : "draft",
        fileName: textOnly ? "" : mediaFile?.name || (sameExistingType ? editingItem.fileName || "" : ""),
        fileType: textOnly ? "text/plain" : mediaFile?.type || (sameExistingType ? editingItem.fileType || "" : ""),
        fileSize: textOnly ? 0 : mediaFile?.size || (sameExistingType ? editingItem.fileSize || 0 : 0),
        storageProvider: textOnly ? "firestore-text" : "cloudinary"
      };
      if (editingItem) {
        if (typeof updateGalleryItem !== "function") {
          throw new Error("Gallery update method unavailable.");
        }
        await updateGalleryItem(editingItem.id, payload);
      } else {
        if (typeof addGalleryItem !== "function") {
          throw new Error("Gallery create method unavailable.");
        }
        await addGalleryItem(payload);
      }
      if (!mountedRef.current) return;
      toast.success(editingItem ? "Gallery item updated." : "Gallery item added.");
      setCategory("all");
      setTypeFilter("all");
      setVisibleCount(cardsPerRow);
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error("CYC gallery save:", error);
      if (mountedRef.current) {
        toast.error(uploading ? error.message : "We couldn't save this gallery item. Please check your connection and sign-in, then retry.");
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setSubmitting(false);
        setUploadProgress(0);
        setStage("");
      }
    }
  };
  const handleDelete = async item => {
    if (busyRef.current || !canContribute || !currentUser || !canEdit(item)) {
      return;
    }
    if (!window.confirm(`Remove "${item.title || "this gallery item"}" from the website?`)) {
      return;
    }
    busyRef.current = true;
    setDeletingId(item.id);
    try {
      assertAccess(currentUser.uid);
      if (typeof deleteGalleryItem !== "function") {
        throw new Error("Gallery delete method unavailable.");
      }
      await deleteGalleryItem(item.id);
      if (!mountedRef.current) return;
      if (editingItem?.id === item.id) {
        resetForm();
        setShowForm(false);
      }
      if (modal?.id === item.id) {
        setModal(null);
      }
      toast.success("Gallery item removed.");
    } catch (error) {
      console.error("CYC gallery delete:", error);
      if (mountedRef.current) {
        toast.error("We couldn't remove this item. Please try again.");
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setDeletingId(null);
      }
    }
  };
  const closeModal = () => {
    if (shareBusyRef.current) return;
    setModal(previous => previous?.kind === "share" && previous.back ? {
      kind: "preview",
      id: previous.id,
      play: false
    } : null);
  };
  const copyLink = async item => {
    const url = getShareUrl(item);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        throw new Error("Clipboard unavailable.");
      }
      toast.success("Gallery link copied.");
    } catch (error) {
      const previousFocus = document.activeElement;
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      try {
        textarea.focus();
        textarea.select();
        if (!document.execCommand("copy")) {
          throw error;
        }
        toast.success("Gallery link copied.");
      } catch (copyError) {
        console.error("Gallery copy link:", copyError);
        toast.error("Couldn't copy automatically. Select and copy the link shown below.");
      } finally {
        textarea.remove();
        if (previousFocus?.isConnected) {
          previousFocus.focus();
        }
      }
    }
  };
  const externalShare = (platform, item) => {
    const url = getShareUrl(item);
    const text = getShareText(item);
    const links = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${url}`)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      email: `mailto:?subject=${encodeURIComponent(item.title || "CYC Gallery")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
    };
    if (!links[platform]) return;
    if (platform === "email") {
      window.location.href = links[platform];
    } else {
      window.open(links[platform], "_blank", "noopener,noreferrer,width=720,height=640");
    }
  };
  const nativeShare = async item => {
    if (shareBusyRef.current) return;
    if (!navigator.share) {
      toast.info("Choose a sharing option below or copy the link.");
      return;
    }
    const payload = {
      title: item.title || "CYC Gallery",
      text: getShareText(item),
      url: getShareUrl(item)
    };
    const readyFile = preparedShareFile?.id === item.id ? preparedShareFile.file : null;
    if (readyFile && navigator.canShare?.({
      ...payload,
      files: [readyFile]
    })) {
      payload.files = [readyFile];
    }
    shareBusyRef.current = true;
    setShareBusy(true);
    try {
      await navigator.share(payload);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Gallery native share:", error);
        toast.error("Sharing was unavailable. Please choose a platform or copy the link.");
      }
    } finally {
      shareBusyRef.current = false;
      if (mountedRef.current) {
        setShareBusy(false);
      }
    }
  };
  const failImage = url => setFailedImages(previous => previous.includes(url) ? previous : [...previous, url]);
  const mediaLabel = item => mediaTypeOf(item) === "photo" ? "Photo" : mediaTypeOf(item) === "video" ? "Video" : "Story";
  return <section id="gallery" aria-labelledby="cyc-gallery-title" className="scroll-mt-40 bg-[#E9FFF3] px-3 py-16 sm:px-5 md:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#0B7A3E]">
            Our Community in Pictures
          </p>
          <h2 id="cyc-gallery-title" className="mb-4 text-3xl font-extrabold text-[#065F2F] md:text-5xl">
            CYC Gallery
          </h2>
          <p className="mx-auto max-w-2xl leading-relaxed text-slate-600">
            Explore photographs, videos and stories from
            CYC Jenta Adamu Ward&apos;s activities, events
            and community projects.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            {items.length} gallery item
            {items.length === 1 ? "" : "s"}
          </p>
          <div className="mx-auto mt-5 h-1 w-20 rounded-full bg-[#F2B705]" />
        </div>
        {canContribute && <div className="mb-6 flex justify-end">
            <button type="button" disabled={busy} onClick={() => showForm ? closeForm() : openForm()} className={BUTTON_CLASS}>
              {showForm ? <FaTimes /> : <FaPlus />}
              {showForm ? "Close Form" : "Add Gallery Item"}
            </button>
          </div>}
        {canContribute && showForm && <form ref={formRef} onSubmit={handleSubmit} className="mb-10 rounded-3xl border border-[#C9F5DC] bg-white p-5 md:p-8">
            <h3 className="mb-6 text-xl font-extrabold text-[#065F2F]">
              {editingItem ? "Edit Gallery Item" : "Add Gallery Item"}
            </h3>
            <fieldset disabled={busy || checkingVideo}>
              <div className="grid gap-5 md:grid-cols-2">
                <FormField label="Title *" id="gallery-title">
                  <input id="gallery-title" name="title" value={form.title} required onChange={event => changeField("title", event.target.value)} className={INPUT_CLASS} />
                </FormField>
                <FormField label="Category *" id="gallery-category">
                  <select id="gallery-category" value={form.category} onChange={event => changeField("category", event.target.value)} className={INPUT_CLASS}>
                    {!CATEGORIES.some(item => item.value === form.category) && <option value={form.category}>
                        {categoryTitle(form.category)}
                      </option>}
                    {CATEGORIES.map(item => <option key={item.value} value={item.value}>
                        {item.label}
                      </option>)}
                  </select>
                </FormField>
                <FormField label="Content type" id="gallery-type">
                  <select id="gallery-type" value={form.mediaType} onChange={event => changeType(event.target.value)} className={INPUT_CLASS}>
                    <option value="photo">
                      Photograph
                    </option>
                    <option value="video">Video</option>
                    <option value="text">
                      Text story
                    </option>
                  </select>
                </FormField>
                <FormField label="Publication status" id="gallery-status">
                  <select id="gallery-status" value={form.status} onChange={event => changeField("status", event.target.value)} className={INPUT_CLASS}>
                    <option value="published">
                      Published
                    </option>
                    <option value="draft">Draft</option>
                  </select>
                </FormField>
                {form.mediaType !== "text" && <FormField label={editingItem ? "Replace photograph or video" : "Choose photograph or video *"} id="gallery-file">
                    <input id="gallery-file" ref={mediaInputRef} type="file" accept="image/*,video/*" onChange={selectMedia} className={INPUT_CLASS} />
                    <p className="mt-2 text-xs text-slate-500">
                      Photos: 10MB maximum. Videos: 50MB
                      maximum and up to 3 minutes.
                    </p>
                    {mediaFile && <p className="mt-2 break-words text-sm text-[#065F2F]">
                        Selected: {mediaFile.name}
                      </p>}
                    {(mediaPreview || form.mediaUrl) && (form.mediaType === "photo" ? <img src={mediaPreview || form.mediaUrl} alt="Selected gallery photograph" className="mt-3 max-h-56 rounded-xl object-contain" /> : <video key={mediaPreview || form.mediaUrl} src={mediaPreview || form.mediaUrl} controls playsInline preload="metadata" className="mt-3 max-h-56 w-full rounded-xl bg-black" />)}
                  </FormField>}
                {form.mediaType === "video" && <FormField label="Optional video thumbnail" id="gallery-thumbnail">
                    <input id="gallery-thumbnail" ref={thumbnailInputRef} type="file" accept="image/*" onChange={selectThumbnail} className={INPUT_CLASS} />
                    {(thumbnailPreview || form.thumbnailUrl) && <div className="mt-3">
                        <img src={thumbnailPreview || form.thumbnailUrl} alt="Selected video thumbnail" className="max-h-40 rounded-xl object-contain" />
                        <button type="button" onClick={clearThumbnail} className="mt-2 text-sm font-bold text-red-600">
                          Remove thumbnail
                        </button>
                      </div>}
                  </FormField>}
                <FormField label="Source / photo credit" id="gallery-source">
                  <input id="gallery-source" value={form.source} onChange={event => changeField("source", event.target.value)} className={INPUT_CLASS} />
                </FormField>
                <FormField label={form.mediaType === "text" ? "Story text *" : "Description / caption"} id="gallery-description" className="md:col-span-2">
                  <textarea id="gallery-description" rows={form.mediaType === "text" ? 9 : 5} value={form.description} required={form.mediaType === "text"} onChange={event => changeField("description", event.target.value)} className={INPUT_CLASS} />
                </FormField>
              </div>
            </fieldset>
            {checkingVideo && <p role="status" className="mt-4 text-sm text-[#065F2F]">
                Checking video duration…
              </p>}
            {submitting && <div role="status" className="mt-5">
                {stage !== "Saving gallery item" && <progress max="100" value={uploadProgress} className="w-full" />}
                <p className="mt-2 text-sm text-[#065F2F]">
                  {stage}…{" "}
                  {stage !== "Saving gallery item" ? `${uploadProgress}%` : ""}
                </p>
              </div>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={busy || checkingVideo} className={BUTTON_CLASS}>
                {submitting ? "Saving…" : editingItem ? "Update Gallery Item" : "Save Gallery Item"}
              </button>
              <button type="button" disabled={busy} onClick={closeForm} className="rounded-full border border-[#065F2F] px-5 py-3 font-bold text-[#065F2F] disabled:opacity-50">
                Cancel
              </button>
            </div>
          </form>}
        <div className="mx-auto mb-8 grid max-w-2xl gap-4 sm:grid-cols-2">
          <FormField label="Gallery category" id="gallery-filter">
            <select id="gallery-filter" value={category} onChange={event => {
            setCategory(event.target.value);
            setVisibleCount(cardsPerRow);
          }} className={INPUT_CLASS}>
              <option value="all">
                All categories
              </option>
              {[...new Set([...CATEGORIES.map(item => item.value), ...items.map(item => item.category || "activities")])].map(value => <option key={value} value={value}>
                  {categoryTitle(value)}
                </option>)}
            </select>
          </FormField>
          <FormField label="Content type" id="gallery-media-filter">
            <select id="gallery-media-filter" value={typeFilter} onChange={event => {
            setTypeFilter(event.target.value);
            setVisibleCount(cardsPerRow);
          }} className={INPUT_CLASS}>
              <option value="all">All content</option>
              <option value="photo">Photographs</option>
              <option value="video">Videos</option>
              <option value="text">Stories</option>
            </select>
          </FormField>
        </div>
        {listenerErrors.gallery ? <p role="status" className="rounded-xl bg-white p-8 text-center text-slate-600">
            We couldn&apos;t load the gallery. Please
            try again later.
          </p> : loading || profileLoading ? <p role="status" className="py-8 text-center text-slate-600">
            Loading gallery…
          </p> : !filteredItems.length ? <div className="rounded-3xl border border-dashed border-[#C9F5DC] bg-white p-10 text-center">
            <FaImage className="mx-auto mb-4 text-4xl text-[#0B7A3E]" />
            <h3 className="mb-2 text-xl font-extrabold text-[#065F2F]">
              No gallery items to display
            </h3>
            <p className="text-sm text-slate-600">
              Published photographs, videos and stories
              will appear here as they are added.
            </p>
          </div> : <>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {displayedItems.map(item => {
            const type = mediaTypeOf(item);
            const thumbnail = type === "photo" ? item.mediaUrl : videoThumbnail(item);
            const editable = canEdit(item);
            const openPreview = (play = false) => setModal({
              kind: "preview",
              id: item.id,
              play
            });
            return <article key={item.id} className="bg-white border border-[#C9F5DC] rounded-xl shadow-md overflow-hidden hover:shadow-2xl transition">
                    <div className="relative overflow-hidden rounded-xl">
                      <button type="button" onClick={() => openPreview(type === "video")} aria-label={`View ${item.title || "gallery item"}`} className="group relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl bg-[#065F2F] sm:h-48 md:h-64">
                        {thumbnail && !failedImages.includes(thumbnail) ? <img src={thumbnail} alt={type === "photo" ? item.title || "Gallery photograph" : ""} loading="lazy" onError={() => failImage(thumbnail)} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : type === "text" ? <div className="w-full p-4 text-left sm:p-6">
                            <FaFileAlt className="mb-3 text-3xl text-[#F2B705] sm:text-4xl" />
                            <p className="line-clamp-3 text-sm font-bold text-white sm:text-xl">{item.title}</p>
                          </div> : type === "video" ? <video src={item.mediaUrl} muted playsInline preload="metadata" className="h-full w-full object-cover opacity-80" /> : <FaImage className="text-5xl text-[#BFE8A8]" />}
                        {type === "video" && <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-[#065F2F] shadow-2xl transition group-hover:scale-110 sm:h-14 sm:w-14 md:h-20 md:w-20">
                              <FaPlayCircle className="text-3xl sm:text-4xl md:text-5xl" />
                            </span>
                          </span>}
                      </button>

                      <span className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-[#065F2F] px-2 py-1 text-[9px] font-bold text-white sm:left-4 sm:top-4 sm:px-3 sm:text-xs">
                        {type === "photo" ? <FaImage /> : type === "video" ? <FaPlayCircle /> : <FaFileAlt />}
                        {mediaLabel(item)}
                      </span>

                      {item.status === "published" && <button type="button" onClick={() => setModal({
                  kind: "share",
                  id: item.id
                })} aria-label={`Share ${item.title || "gallery item"}`} title="Share" className={`absolute top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs text-[#065F2F] shadow-lg transition hover:bg-[#0B7A3E] hover:text-white sm:top-4 sm:h-9 sm:w-9 sm:text-base ${editable ? "right-[4.5rem] sm:right-[6.5rem]" : "right-2 sm:right-4"}`}>
                          <FaShareAlt />
                        </button>}

                      {editable && <div className="absolute right-2 top-2 z-20 flex gap-1 sm:right-4 sm:top-4 sm:gap-2">
                          <button type="button" title="Edit" aria-label={`Edit ${item.title}`} disabled={busy} onClick={() => openForm(item)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs text-[#065F2F] shadow-lg transition hover:bg-[#0B7A3E] hover:text-white disabled:opacity-50 sm:h-9 sm:w-9 sm:text-base"><FaEdit /></button>
                          <button type="button" title="Delete" aria-label={`Delete ${item.title}`} disabled={busy} onClick={() => handleDelete(item)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-xs text-red-600 shadow-lg transition hover:bg-red-600 hover:text-white disabled:opacity-50 sm:h-9 sm:w-9 sm:text-base"><FaTrash /></button>
                        </div>}
                    </div>

                    <div className="p-3 sm:p-4">
                      <div className="mb-2 flex items-start justify-between gap-2 sm:gap-3">
                        <p className="line-clamp-1 text-[9px] font-bold uppercase tracking-widest text-[#F2B705] sm:text-xs">{categoryTitle(item.category)}</p>
                        {editable && <span className={`hidden rounded-full border px-2 py-1 text-[10px] font-bold uppercase sm:inline-block ${item.status === "published" ? "border-[#C9F5DC] bg-[#E9FFF3] text-[#065F2F]" : "border-yellow-200 bg-yellow-50 text-yellow-700"}`}>{item.status || "draft"}</span>}
                      </div>
                      <h3 className="line-clamp-2 text-sm font-bold text-[#065F2F] sm:text-lg">
                        <button type="button" onClick={() => openPreview()} className="text-left">{item.title || "Gallery update"}</button>
                      </h3>
                      {item.description && <p className="mt-2 line-clamp-2 text-xs text-slate-500 sm:text-sm">{item.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-[#065F2F] sm:mt-3 sm:text-sm">
                        <button type="button" onClick={() => openPreview()} className="hover:text-[#0B7A3E]">Read More</button>
                        {type === "video" && <button type="button" onClick={() => openPreview(true)} className="inline-flex items-center gap-1 hover:text-[#0B7A3E]"><FaPlayCircle /> Play</button>}
                      </div>
                      <p className="mt-3 text-[10px] text-slate-400 sm:text-xs">{formatAddedTime(item.createdAt)}</p>
                      {item.source && item.source !== "Cloudinary" && <p className="mt-1 hidden break-words text-xs text-slate-400 sm:block">Source: {item.source}</p>}
                      {deletingId === item.id && <p role="status" className="mt-2 text-xs text-red-600">Deleting…</p>}
                    </div>
                  </article>;
          })}
            </div>
            {filteredItems.length > cardsPerRow && <div className="mt-8 text-center">
                <button type="button" onClick={() => {
            if (visibleCount < filteredItems.length) {
              setVisibleCount(previous => Math.min(previous + cardsPerRow * MORE_ROWS, filteredItems.length));
            } else {
              setVisibleCount(cardsPerRow);
              scrollTo(document.getElementById("gallery"));
            }
          }} className={BUTTON_CLASS}>
                  {visibleCount < filteredItems.length ? "View More" : "Show Less"}
                </button>
              </div>}
          </>}
      </div>
      {activeItem && modal?.kind === "preview" && <GalleryDialog key="preview" title={activeItem.title || "Gallery update"} onClose={closeModal}>
          {mediaTypeOf(activeItem) === "photo" ? <img src={activeItem.mediaUrl} alt={activeItem.title || "Gallery photograph"} className="max-h-[65vh] w-full rounded-2xl object-contain" /> : mediaTypeOf(activeItem) === "video" ? <video key={activeItem.mediaUrl} src={activeItem.mediaUrl} poster={videoThumbnail(activeItem) || undefined} controls autoPlay={Boolean(modal.play)} playsInline preload="metadata" tabIndex={0} className="max-h-[65vh] w-full rounded-2xl bg-black">
              Your browser does not support embedded
              video.
            </video> : <div className="mb-5 flex items-center gap-3 rounded-xl bg-[#E9FFF3] p-4 font-bold text-[#065F2F]">
              <FaFileAlt />
              Community Story
            </div>}
          {activeItem.description && <p className="mt-6 whitespace-pre-line text-base leading-8 text-slate-700">
              {activeItem.description}
            </p>}
          <div className="mt-6 space-y-1 border-t border-[#C9F5DC] pt-4 text-xs text-slate-500">
            <p>
              {categoryTitle(activeItem.category)}
            </p>
            {activeItem.source && activeItem.source !== "Cloudinary" && <p>Source: {activeItem.source}</p>}
            {activeItem.createdByName && <p>
                Added by:{" "}
                {activeItem.createdByName}
              </p>}
            <p>
              Added on:{" "}
              {formatAddedTime(activeItem.createdAt)}
            </p>
          </div>
          {activeItem.status === "published" && <button type="button" onClick={() => setModal({
        kind: "share",
        id: activeItem.id,
        back: true
      })} className={`${BUTTON_CLASS} mt-5`}>
              <FaShareAlt />
              Share This Item
            </button>}
        </GalleryDialog>}
      {activeItem?.status === "published" && modal?.kind === "share" && <GalleryDialog key="share" title={`Share: ${activeItem.title || "CYC Gallery"}`} onClose={closeModal} share>
            {activeShareImage && !failedImages.includes(activeShareImage) && <img src={activeShareImage} alt="Gallery sharing preview" onError={() => failImage(activeShareImage)} className="mb-5 max-h-52 w-full rounded-xl object-contain" />}
            <button type="button" disabled={shareBusy} onClick={() => nativeShare(activeItem)} className={`${BUTTON_CLASS} w-full`}>
              <FaShareAlt />
              {shareBusy ? "Sharing…" : "Share to Available Apps"}
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              Photos may be attached when supported
              by your device and selected app.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
              {SHARE_PLATFORMS.map(({
          key,
          label,
          Icon
        }) => <button key={key} type="button" disabled={shareBusy} onClick={() => externalShare(key, activeItem)} className="flex flex-col items-center gap-2 rounded-xl border border-[#C9F5DC] p-3 text-[#065F2F] hover:bg-[#E9FFF3] disabled:opacity-50">
                    <Icon className="text-xl" />
                    <span className="text-[10px] font-bold">
                      {label}
                    </span>
                  </button>)}
              <button type="button" disabled={shareBusy} onClick={() => copyLink(activeItem)} className="flex flex-col items-center gap-2 rounded-xl border border-[#C9F5DC] p-3 text-[#065F2F] disabled:opacity-50">
                <FaLink className="text-xl" />
                <span className="text-[10px] font-bold">
                  Copy Link
                </span>
              </button>
            </div>
            <label htmlFor="gallery-share-url" className="mb-2 mt-5 block text-xs font-bold text-slate-600">
              Gallery link
            </label>
            <input id="gallery-share-url" value={shareUrl} readOnly onFocus={event => event.target.select()} className={INPUT_CLASS} />
          </GalleryDialog>}
    </section>;
};
export default Gallery;
