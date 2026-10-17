import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaTimes,
  FaImage,
  FaShareAlt,
  FaWhatsapp,
  FaFacebookF,
  FaTwitter,
  FaLinkedinIn,
  FaTelegramPlane,
  FaEnvelope,
  FaLink,
} from "react-icons/fa";
import { toast } from "react-toastify";
import { useMyContext } from "../Context/MyContext";

const initialFormData = {
  title: "",
  description: "",
  imageUrl: "",
  status: "published",
};

const VIEW_MORE_ROWS = 3;
const EMPTY_NEWS = [];
const PHOTO_LIMIT = 10 * 1024 * 1024;

const News = () => {
  const {
    currentUser,
    canEditContribution,
    news = EMPTY_NEWS,
    loading,
    profileLoading,
    listenerErrors = {},
    addNews,
    updateNews,
    deleteNews,
  } = useMyContext();

  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expandedSelection, setExpandedItem] = useState(null);
  const [previewSelection, setPreviewItem] = useState(null);
  const [cardsPerRow, setCardsPerRow] = useState(2);
  const [visibleCount, setVisibleCount] = useState(2);
  const [formData, setFormData] = useState(initialFormData);
  const [shareSelection, setShareItem] = useState(null);

  const [preparedShareFile, setPreparedShareFile] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [saveStage, setSaveStage] = useState("");
  const busyRef = useRef(false);
  const xhrRef = useRef(null);
  const mountedRef = useRef(true);
  const sessionRef = useRef(null);
  const imageInputRef = useRef(null);
  const uploadCacheRef = useRef(null);
  const requestedNewsRef = useRef("");
  const shareBusyRef = useRef(false);
  const canEdit = (item) => canEditContribution(item);
  sessionRef.current = currentUser?.uid;
  const busy = submitting || Boolean(deletingId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      xhrRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    xhrRef.current?.abort();
    setShowAddForm(false);
    setEditingItem(null);
    setImageFile(null);
    setFormData(initialFormData);
    uploadCacheRef.current = null;
  }, [currentUser?.uid]);

  useEffect(() => {
    const updateCardsPerRow = () => {
      const count = window.innerWidth >= 1024 ? 3 : 2;

      setCardsPerRow(count);
      setVisibleCount((previous) => Math.max(count, previous));
    };

    updateCardsPerRow();
    window.addEventListener("resize", updateCardsPerRow);

    return () => window.removeEventListener("resize", updateCardsPerRow);
  }, []);

  const visibleItems = useMemo(
    () => news.filter((item) => item.status === "published" || canEditContribution(item)),
    [news, canEditContribution]
  );
  const expandedItem = visibleItems.find((item) => item.id === expandedSelection?.id) || null;
  const previewItem = visibleItems.find((item) => item.id === previewSelection?.id) || null;
  const shareItem = visibleItems.find((item) => item.id === shareSelection?.id && item.status === "published") || null;
  const modalKind = shareItem ? "share" : previewItem ? "preview" : expandedItem ? "full" : null;

  useEffect(() => {
    const openRequestedNews = () => {
      if (window.location.hash !== "#news") return;
      const id = new URLSearchParams(window.location.search).get("news");
      if (!id || requestedNewsRef.current === id) return;
      const index = visibleItems.findIndex((item) => item.id === id && item.status === "published");
      if (index < 0) return;
      requestedNewsRef.current = id;
      setVisibleCount((previous) => Math.max(previous, index + 1));
      setPreviewItem(null);
      setExpandedItem(visibleItems[index]);
    };
    openRequestedNews();
    window.addEventListener("popstate", openRequestedNews);
    window.addEventListener("hashchange", openRequestedNews);
    return () => {
      window.removeEventListener("popstate", openRequestedNews);
      window.removeEventListener("hashchange", openRequestedNews);
    };
  }, [visibleItems]);

  useEffect(() => {
    if (!modalKind) return undefined;
    const dialog = document.querySelector(`[data-news-dialog="${modalKind}"]`);
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.querySelector("button")?.focus();
    const keyDown = (event) => {
      if (event.key === "Escape" && !shareBusyRef.current) {
        if (modalKind === "share") setShareItem(null);
        else if (modalKind === "preview") setPreviewItem(null);
        else setExpandedItem(null);
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])'));
      const first = controls[0];
      const last = controls[controls.length - 1];
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
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [modalKind]);

  useEffect(() => {
    setPreparedShareFile(null);
    if (!shareItem?.imageUrl || typeof File === "undefined") return undefined;
    const controller = new AbortController();
    const prepare = async () => {
      try {
        const response = await fetch(shareItem.imageUrl, { mode: "cors", signal: controller.signal });
        if (!response.ok) return;
        const blob = await response.blob();
        if (!blob.type.startsWith("image/") || blob.size > PHOTO_LIMIT) return;
        const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
        const file = new File([blob], `cyc-news-${shareItem.id}.${extension}`, { type: blob.type });
        if (!controller.signal.aborted) setPreparedShareFile({ id: shareItem.id, file });
      } catch (error) {
        if (error.name !== "AbortError") console.warn("CYC news share image:", error);
      }
    };
    prepare();
    return () => controller.abort();
  }, [shareItem?.id, shareItem?.imageUrl]);

  const displayedItems = visibleItems.slice(
    0,
    Math.min(visibleCount, visibleItems.length)
  );

  const hasCardsToToggle = visibleItems.length > cardsPerRow;
  const hasMoreCards = visibleCount < visibleItems.length;

  const formatAddedTime = (createdAt) => {
    if (!createdAt) return "Just now";

    let date;

    if (createdAt?.toDate) {
      date = createdAt.toDate();
    } else if (typeof createdAt?.seconds === "number") {
      date = new Date(createdAt.seconds * 1000);
    } else if (createdAt instanceof Date) {
      date = createdAt;
    } else {
      date = new Date(createdAt);
    }

    if (Number.isNaN(date.getTime())) return "Just now";

    return date.toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getShortDescription = (description = "", maxLength = 105) => {
    const cleanText = String(description).replace(/\s+/g, " ").trim();

    if (cleanText.length <= maxLength) return cleanText;

    return `${cleanText.slice(0, maxLength).trimEnd()}...`;
  };

  const buildShareUrl = (item) => {
    if (typeof window === "undefined") return "";

    const url = new URL(window.location.href);
    url.searchParams.delete("gallery");
    url.searchParams.set("news", item?.id || "");
    url.hash = "news";

    return url.toString();
  };

  const buildShareText = (item) => {
    const title = item?.title || "CYC Jenta Adamu Ward News";
    const description = getShortDescription(item?.description || "", 150);

    return description ? `${title}\n\n${description}` : title;
  };

  const openShare = (item, event) => {
    event?.stopPropagation();
    if (item?.status !== "published" || shareBusyRef.current) return;
    setShareItem(item);
  };

  const closeShare = () => {
    if (shareBusyRef.current) return;
    setShareItem(null);
  };

  const shareToPlatform = (platform, item) => {
    if (item?.status !== "published") return;
    const shareUrl = buildShareUrl(item);
    const title = item?.title || "CYC Jenta Adamu Ward News";
    const text = buildShareText(item);
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title);
    const encodedText = encodeURIComponent(text);

    const platformUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${shareUrl}`)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(
        `${text}\n\n${shareUrl}`
      )}`,
    };

    const targetUrl = platformUrls[platform];

    if (!targetUrl) return;

    if (platform === "email") {
      window.location.href = targetUrl;
    } else {
      window.open(targetUrl, "_blank", "noopener,noreferrer,width=760,height=680");
    }
  };

  const copyShareLink = async (item) => {
    if (item?.status !== "published") return;
    const shareUrl = buildShareUrl(item);
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("News link copied.");
    } catch {
      const previousFocus = document.activeElement;
      const input = document.createElement("textarea");
      input.value = shareUrl;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      try {
        input.focus();
        input.select();
        if (!document.execCommand("copy")) throw new Error("Clipboard unavailable.");
        toast.success("News link copied.");
      } catch (error) {
        console.error("CYC news copy link:", error);
        toast.error("Couldn't copy the link. Select and copy the link shown below.");
      } finally {
        input.remove();
        if (previousFocus?.isConnected) previousFocus.focus();
      }
    }
  };

  const shareNatively = async (item) => {
    if (item?.status !== "published" || shareBusyRef.current) return;
    if (!navigator.share) {
      openShare(item);
      toast.info("Choose a sharing option or copy the link.");
      return;
    }
    const shareData = {
      title: item.title || "CYC Jenta Adamu Ward News",
      text: buildShareText(item),
      url: buildShareUrl(item),
    };
    const file = preparedShareFile?.id === item.id ? preparedShareFile.file : null;
    if (file && navigator.canShare?.({ ...shareData, files: [file] })) {
      shareData.files = [file];
    }
    shareBusyRef.current = true;
    setShareBusy(true);
    try {
      await navigator.share(shareData);
      if (mountedRef.current) setShareItem(null);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("CYC news native share:", error);
        if (mountedRef.current) toast.error("Sharing is unavailable. Choose a platform or copy the link.");
      }
    } finally {
      shareBusyRef.current = false;
      if (mountedRef.current) setShareBusy(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setImageFile(null);
    setUploadProgress(0);
    setEditingItem(null);
    setSaveStage("");
    uploadCacheRef.current = null;
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const closeForm = () => {
    if (busyRef.current) return;
    resetForm();
    setShowAddForm(false);
  };

  const handleViewMore = () => {
    setVisibleCount((prev) =>
      Math.min(prev + cardsPerRow * VIEW_MORE_ROWS, visibleItems.length)
    );
  };

  const handleShowLess = () => {
    setVisibleCount(cardsPerRow);

    scrollToNews();
  };

  const scrollToNews = () => {
    const target = document.getElementById("news");
    if (!target) return;
    const headerBottom = Math.max(0, document.querySelector("header")?.getBoundingClientRect().bottom || 0);
    window.scrollTo({
      top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - headerBottom - 12),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file || busyRef.current) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      e.target.value = "";
      return;
    }

    const maxImageSize = 10 * 1024 * 1024;

    if (file.size > maxImageSize) {
      toast.error("Image is too large. Please upload an image below 10MB.");
      e.target.value = "";
      return;
    }

    setImageFile(file);
    uploadCacheRef.current = null;
  };

  const uploadToCloudinary = (file, folderName) => {
    return new Promise((resolve, reject) => {
      if (!file) {
        resolve("");
        return;
      }

      const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        console.error("CYC news: missing Cloudinary configuration.");
        reject(new Error("Picture uploads are not configured yet. Please contact the council."));
        return;
      }

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      const body = new FormData();
      body.append("file", file);
      body.append("upload_preset", uploadPreset);
      body.append("folder", folderName);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.timeout = 300000;
      xhr.open("POST", uploadUrl);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && mountedRef.current) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(progress);
        }
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);

          if (xhr.status >= 200 && xhr.status < 300 && data.secure_url) {
            if (mountedRef.current) setUploadProgress(100);
            resolve(data.secure_url);
          } else {
            console.error("CYC news upload:", data?.error?.message);
            reject(new Error("The picture could not be uploaded. Please try again."));
          }
        } catch {
          reject(new Error("The upload did not finish correctly. Please try again."));
        }
      };

      xhr.onerror = () => {
        reject(new Error("Upload failed. Please check your internet connection."));
      };

      xhr.onabort = () => reject(new Error("The upload was interrupted."));
      xhr.ontimeout = () => reject(new Error("The upload took too long. Please try a stronger connection."));
      xhr.onloadend = () => {
        if (xhrRef.current === xhr) xhrRef.current = null;
      };
      xhr.send(body);
    });
  };

  const handleEdit = (item) => {
    if (busyRef.current || !canEdit(item)) return;
    resetForm();
    setEditingItem(item);
    setShowAddForm(true);
    setImageFile(null);
    setUploadProgress(0);

    setFormData({
      title: item.title || "",
      description: item.description || "",
      imageUrl: item.imageUrl || "",
      status: item.status || "published",
    });

    window.requestAnimationFrame(scrollToNews);
  };

  const assertSession = (uid) => {
    if (!mountedRef.current || sessionRef.current !== uid) {
      throw new Error("Your session has changed. Please sign in again.");
    }
  };

  const handleDelete = async (item) => {
    if (busyRef.current || !currentUser || !canEdit(item)) return;
    if (!window.confirm(`Delete "${item.title || "this news post"}" from the website?`)) return;
    busyRef.current = true;
    setDeletingId(item.id);
    const uid = currentUser.uid;
    try {
      assertSession(uid);
      await deleteNews(item.id);
      if (!mountedRef.current || sessionRef.current !== uid) return;
      if (editingItem?.id === item.id) {
        resetForm();
        setShowAddForm(false);
      }
      toast.success("News deleted successfully.");
    } catch (error) {
      console.error("CYC news delete:", error);
      if (mountedRef.current) toast.error("We couldn't delete this news post. Please try again.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setDeletingId(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busyRef.current) return;
    if (!currentUser) {
      toast.error("Please sign in before adding news.");
      return;
    }
    if (editingItem && !canEdit(editingItem)) {
      toast.error("You can only edit news you added.");
      return;
    }
    if (!formData.title.trim() || !formData.description.trim()) {
      toast.error("Please enter the news title and content.");
      return;
    }
    if (!imageFile && !formData.imageUrl) {
      toast.error("Please select a news picture.");
      return;
    }
    busyRef.current = true;
    setSubmitting(true);
    const uid = currentUser.uid;
    let uploading = false;
    try {
      assertSession(uid);
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        if (uploadCacheRef.current?.file === imageFile) {
          imageUrl = uploadCacheRef.current.url;
        } else {
          uploading = true;
          setSaveStage("Uploading picture");
          setUploadProgress(0);
          imageUrl = await uploadToCloudinary(imageFile, "cyc/jenta-adamu-ward/news");
          uploadCacheRef.current = { file: imageFile, url: imageUrl };
          uploading = false;
        }
      }
      assertSession(uid);
      setSaveStage("Saving news");
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: editingItem?.category || "General",
        imageUrl,
        status: formData.status === "published" ? "published" : "draft",
        fileName: imageFile?.name || editingItem?.fileName || "",
        fileType: imageFile?.type || editingItem?.fileType || "",
        fileSize: imageFile?.size || editingItem?.fileSize || 0,
        storageProvider: "cloudinary",
      };
      if (editingItem) await updateNews(editingItem.id, payload);
      else await addNews(payload);
      if (!mountedRef.current || sessionRef.current !== uid) return;
      toast.success(editingItem ? "News updated successfully." : "News added successfully.");
      resetForm();
      setShowAddForm(false);
      setVisibleCount(cardsPerRow);
    } catch (error) {
      console.error("CYC news save:", error);
      if (mountedRef.current) toast.error(uploading ? error.message : "We couldn't save this news post. Please check your connection and sign-in, then try again.");
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setSubmitting(false);
        setUploadProgress(0);
        setSaveStage("");
      }
    }
  };

  const openCardPreview = (item) => {
    setExpandedItem(null);
    setPreviewItem(item);
  };

  return (
    <section id="news" className="scroll-mt-40 bg-white py-20 px-3 sm:px-5 md:px-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-[#F2B705] mb-3">
            News & Updates
          </p>

          <h2 className="text-4xl md:text-5xl font-extrabold text-[#065F2F] mb-5">
            Latest News
          </h2>

          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Follow council announcements, youth activities, community news
            and development stories from CYC Jenta Adamu Ward.
          </p>

          <p className="text-sm text-slate-500 mt-4">
            Total news uploaded:{" "}
            <span className="font-bold text-[#065F2F]">
              {visibleItems.length}
            </span>
          </p>

          <div className="w-24 h-1 bg-[#F2B705] mx-auto mt-6 rounded-full"></div>
        </div>

        {currentUser && (
          <div className="text-center mb-6">
            <button
              disabled={busy}
              onClick={() => {
                if (busyRef.current) return;
                if (showAddForm) {
                  closeForm();
                } else {
                  resetForm();
                  setShowAddForm(true);
                }
              }}
              className="bg-[#065F2F] text-white px-6 py-3 rounded-full inline-flex items-center gap-2 mx-auto font-bold hover:bg-[#0B7A3E] transition shadow-lg"
              type="button"
            >
              {showAddForm ? <FaTimes /> : <FaPlus />}
              {showAddForm ? "Close Form" : "Add News"}
            </button>
          </div>
        )}

        {currentUser && showAddForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-10 bg-[#E9FFF3] p-6 md:p-10 rounded-3xl shadow-xl border border-[#C9F5DC]"
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
              <h3 className="text-2xl font-extrabold text-[#065F2F]">
                {editingItem ? "Edit News" : "Add News Update"}
              </h3>

              {editingItem && (
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 text-sm font-bold text-red-600 hover:text-red-700"
                >
                  <FaTimes />
                  Cancel Edit
                </button>
              )}
            </div>

            <fieldset disabled={busy}>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="news-title" className="block text-sm font-bold text-slate-700 mb-2">
                    News Title *
                  </label>
                  <input
                    type="text"
                    id="news-title"
                    maxLength={250}
                    name="title"
                    placeholder="Enter news title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full p-3 border border-[#C9F5DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="news-status" className="block text-sm font-bold text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    id="news-status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full p-3 border border-[#C9F5DC] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="news-picture" className="block text-sm font-bold text-slate-700 mb-2">
                    {editingItem ? "Replace News Picture" : "News Picture *"}
                  </label>
                  <input
                    id="news-picture"
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="w-full p-3 border border-[#C9F5DC] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                    required={!editingItem}
                  />

                  {imageFile && (
                    <p className="text-sm text-slate-500 mt-2">
                      Selected:{" "}
                      <span className="font-semibold text-[#065F2F]">
                        {imageFile.name}
                      </span>
                    </p>
                  )}

                  {editingItem && !imageFile && (
                    <p className="text-sm text-slate-500 mt-2">
                      Current picture will remain unchanged unless you select a new
                      picture.
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="news-description" className="block text-sm font-bold text-slate-700 mb-2">
                    News Content *
                  </label>
                  <textarea
                    id="news-description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="7"
                    className="w-full p-3 border border-[#C9F5DC] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]"
                    placeholder="Write the news content here..."
                    required
                  ></textarea>
                </div>
              </div>

            </fieldset>
            {submitting && (
              <div className="mt-6">
                <div className="w-full bg-white rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-[#0B7A3E] h-3 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-slate-600 mt-2">
                  {saveStage === "Saving news" ? "Saving news..." : `Uploading picture... ${uploadProgress}%`}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 bg-[#065F2F] text-white px-8 py-3 rounded-full font-bold hover:bg-[#0B7A3E] transition disabled:opacity-60 shadow-lg"
            >
              {submitting
                ? editingItem
                  ? "Updating..."
                  : "Uploading..."
                : editingItem
                ? "Update News"
                : "Upload & Save News"}
            </button>
          </form>
        )}

        {listenerErrors.news ? (
          <p role="status" className="rounded-2xl bg-[#E9FFF3] p-8 text-center text-slate-600">We couldn't load the news. Please try again later.</p>
        ) : loading || profileLoading ? (
          <p role="status" className="py-8 text-center text-slate-600">Loading news...</p>
        ) : visibleItems.length === 0 ? (
          <div className="bg-[#E9FFF3] border border-[#C9F5DC] rounded-2xl p-10 text-center shadow-md">
            <FaImage className="text-[#F2B705] text-5xl mx-auto mb-4" />
            <h4 className="text-2xl font-bold text-[#065F2F] mb-2">
              No news added yet
            </h4>
            <p className="text-slate-500">
              Published news will appear here once uploaded.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {displayedItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openCardPreview(item)}
                  className="bg-white border border-[#C9F5DC] rounded-xl shadow-md overflow-hidden hover:shadow-2xl transition cursor-pointer"
                >
                  <div className="relative overflow-hidden rounded-xl">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-40 sm:h-48 md:h-64 object-cover rounded-xl"
                    />

                    <div className="absolute top-2 sm:top-4 left-2 sm:left-4 z-30 bg-[#065F2F] text-white text-[9px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-full pointer-events-none">
                      News
                    </div>

                    <div
                      className="absolute top-2 sm:top-4 right-2 sm:right-4 z-40 flex gap-1 sm:gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.status === "published" && <button
                        onClick={(e) => openShare(item, e)}
                        className="bg-white text-[#065F2F] h-7 w-7 sm:h-9 sm:w-9 rounded-full shadow-lg flex items-center justify-center hover:bg-[#F2B705] hover:text-[#065F2F] transition text-xs sm:text-base"
                        type="button"
                        title="Share news"
                        aria-label={`Share ${item.title || "news"}`}
                      >
                        <FaShareAlt />
                      </button>}

                      {canEdit(item) && item?.id && (
                        <>
                          <button
                            onClick={() => handleEdit(item)}
                            disabled={busy}
                            className="bg-white text-[#065F2F] h-7 w-7 sm:h-9 sm:w-9 rounded-full shadow-lg flex items-center justify-center hover:bg-[#0B7A3E] hover:text-white transition text-xs sm:text-base"
                            type="button"
                            title="Edit"
                          >
                            <FaEdit />
                          </button>

                          <button
                            onClick={() => handleDelete(item)}
                            disabled={busy}
                            className="bg-white text-red-600 h-7 w-7 sm:h-9 sm:w-9 rounded-full shadow-lg flex items-center justify-center hover:bg-red-600 hover:text-white transition disabled:opacity-60 text-xs sm:text-base"
                            type="button"
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2">
                      <p className="text-[9px] sm:text-xs uppercase tracking-widest text-[#F2B705] font-bold line-clamp-1">
                        News Update
                      </p>

                      {canEdit(item) && (
                        <span
                          className={`hidden sm:inline-block text-[10px] uppercase font-bold px-2 py-1 rounded-full ${
                            item.status === "published"
                              ? "bg-[#E9FFF3] text-[#065F2F] border border-[#C9F5DC]"
                              : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                          }`}
                        >
                          {item.status || "published"}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm sm:text-lg text-[#065F2F] line-clamp-2">
                      {item.title}
                    </h4>

                    {item.description && (
                      <p className="text-[11px] sm:text-sm text-slate-500 mt-2 leading-relaxed line-clamp-2">
                        {getShortDescription(item.description)}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedItem(item);
                      }}
                      className="mt-2 sm:mt-3 text-[11px] sm:text-sm font-bold text-[#065F2F] hover:text-[#0B7A3E]"
                    >
                      Read More
                    </button>

                    {item.createdByName && (
                      <p className="hidden sm:block text-xs text-slate-400 mt-3">
                        Added by: {item.createdByName}
                      </p>
                    )}

                    <p className="hidden sm:block text-xs text-slate-400 mt-1">
                      Added on: {formatAddedTime(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {hasCardsToToggle && (
              <div className="text-center mt-10">
                <button
                  type="button"
                  onClick={hasMoreCards ? handleViewMore : handleShowLess}
                  className="bg-[#065F2F] text-white px-8 py-3 rounded-full font-bold hover:bg-[#0B7A3E] transition shadow-lg"
                >
                  {hasMoreCards ? "View More" : "Show Less"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {previewItem && (
        <div className="fixed inset-0 z-[999] bg-black/75 px-4 py-8 flex items-center justify-center">
          <div data-news-dialog="preview" role="dialog" aria-modal="true" aria-label="CYC news preview" className="bg-white w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-[#C9F5DC]">
            <div className="sticky top-0 bg-white border-b border-[#C9F5DC] p-5 flex items-start justify-between gap-4 rounded-t-3xl z-10">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#F2B705] mb-2">
                  News Update
                </p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-[#065F2F]">
                  {previewItem.title}
                </h3>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {previewItem.status === "published" && <button
                  type="button"
                  onClick={() => openShare(previewItem)}
                  className="h-10 w-10 rounded-full bg-[#E9FFF3] text-[#065F2F] flex items-center justify-center hover:bg-[#065F2F] hover:text-white transition"
                  title="Share news"
                  aria-label="Share news"
                >
                  <FaShareAlt />
                </button>}

                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="h-10 w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition"
                  aria-label="Close preview"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="p-5 md:p-8">
              {previewItem.imageUrl && (
                <img
                  src={previewItem.imageUrl}
                  alt={previewItem.title}
                  className="w-full max-h-[65vh] object-cover rounded-2xl"
                />
              )}

              {previewItem.description && (
                <p className="text-slate-700 text-base md:text-lg leading-8 whitespace-pre-line mt-6">
                  {previewItem.description}
                </p>
              )}

              <div className="mt-6 pt-5 border-t border-[#C9F5DC] text-xs text-slate-400 space-y-1">
                {previewItem.createdByName && (
                  <p>Added by: {previewItem.createdByName}</p>
                )}
                <p>Added on: {formatAddedTime(previewItem.createdAt)}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setPreviewItem(null);
                  setExpandedItem(previewItem);
                }}
                className="mt-6 bg-[#065F2F] text-white px-6 py-3 rounded-full font-bold hover:bg-[#0B7A3E] transition shadow-lg"
              >
                Read Full News
              </button>
            </div>
          </div>
        </div>
      )}

      {expandedItem && (
        <div className="fixed inset-0 z-[999] bg-black/70 px-4 py-8 flex items-center justify-center">
          <div data-news-dialog="full" role="dialog" aria-modal="true" aria-label="CYC news full" className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl border border-[#C9F5DC]">
            <div className="sticky top-0 bg-white border-b border-[#C9F5DC] p-5 flex items-start justify-between gap-4 rounded-t-3xl">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#F2B705] mb-2">
                  News Update
                </p>
                <h3 className="text-2xl md:text-3xl font-extrabold text-[#065F2F]">
                  {expandedItem.title}
                </h3>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {expandedItem.status === "published" && <button
                  type="button"
                  onClick={() => openShare(expandedItem)}
                  className="h-10 w-10 rounded-full bg-[#E9FFF3] text-[#065F2F] flex items-center justify-center hover:bg-[#065F2F] hover:text-white transition"
                  title="Share news"
                  aria-label="Share news"
                >
                  <FaShareAlt />
                </button>}

                <button
                  type="button"
                  onClick={() => setExpandedItem(null)}
                  className="h-10 w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition"
                  aria-label="Close full news"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {expandedItem.imageUrl && (
              <img
                src={expandedItem.imageUrl}
                alt={expandedItem.title}
                className="w-full max-h-[420px] object-cover"
              />
            )}

            <div className="p-5 md:p-8">
              <p className="text-slate-700 text-base md:text-lg leading-8 whitespace-pre-line">
                {expandedItem.description}
              </p>

              <div className="mt-8 pt-5 border-t border-[#C9F5DC] text-xs text-slate-400">
                Added on: {formatAddedTime(expandedItem.createdAt)}
              </div>
            </div>
          </div>
        </div>
      )}

      {shareItem && (
        <div
          className="fixed inset-0 z-[1200] bg-black/70 px-4 py-8 flex items-center justify-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeShare();
          }}
        >
          <div data-news-dialog="share" role="dialog" aria-modal="true" aria-label="CYC news share" className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-[#C9F5DC] overflow-hidden">
            <div className="p-5 border-b border-[#C9F5DC] flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-[#F2B705]">
                  Share News
                </p>
                <h3 className="mt-2 text-lg font-extrabold text-[#065F2F] line-clamp-2">
                  {shareItem.title || "CYC Jenta Adamu Ward News"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeShare}
                disabled={shareBusy}
                className="shrink-0 h-9 w-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition"
                aria-label="Close sharing options"
              >
                <FaTimes />
              </button>
            </div>

            {shareItem.imageUrl && (
              <img
                src={shareItem.imageUrl}
                alt={shareItem.title || "CYC Jenta Adamu Ward news"}
                className="w-full h-48 object-cover"
              />
            )}

            <div className="p-5">
              <fieldset disabled={shareBusy}>
              <p className="text-sm text-slate-600">
                Share this news through your preferred platform.
              </p>

              <div className="mt-5 grid grid-cols-4 gap-3">
                <button
                  type="button"
                  onClick={() => shareToPlatform("whatsapp", shareItem)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 hover:bg-green-50 transition"
                  title="Share on WhatsApp"
                >
                  <FaWhatsapp className="text-2xl text-green-600" />
                  <span className="text-[10px] font-bold text-slate-600">
                    WhatsApp
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => shareToPlatform("facebook", shareItem)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 hover:bg-blue-50 transition"
                  title="Share on Facebook"
                >
                  <FaFacebookF className="text-2xl text-blue-600" />
                  <span className="text-[10px] font-bold text-slate-600">
                    Facebook
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => shareToPlatform("twitter", shareItem)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50 transition"
                  title="Share on X"
                >
                  <FaTwitter className="text-2xl text-sky-500" />
                  <span className="text-[10px] font-bold text-slate-600">X</span>
                </button>

                <button
                  type="button"
                  onClick={() => shareToPlatform("linkedin", shareItem)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 hover:bg-blue-50 transition"
                  title="Share on LinkedIn"
                >
                  <FaLinkedinIn className="text-2xl text-blue-700" />
                  <span className="text-[10px] font-bold text-slate-600">
                    LinkedIn
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => shareToPlatform("telegram", shareItem)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 hover:bg-sky-50 transition"
                  title="Share on Telegram"
                >
                  <FaTelegramPlane className="text-2xl text-sky-500" />
                  <span className="text-[10px] font-bold text-slate-600">
                    Telegram
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => shareToPlatform("email", shareItem)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 hover:bg-amber-50 transition"
                  title="Share by email"
                >
                  <FaEnvelope className="text-2xl text-amber-600" />
                  <span className="text-[10px] font-bold text-slate-600">
                    Email
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => copyShareLink(shareItem)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50 transition"
                  title="Copy link"
                >
                  <FaLink className="text-2xl text-slate-600" />
                  <span className="text-[10px] font-bold text-slate-600">
                    Copy Link
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => shareNatively(shareItem)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 p-3 hover:bg-[#E9FFF3] transition"
                  title="More sharing options"
                >
                  <FaShareAlt className="text-2xl text-[#065F2F]" />
                  <span className="text-[10px] font-bold text-slate-600">
                    More
                  </span>
                </button>
              </div>

              </fieldset>
              {shareBusy && <p role="status" className="mt-3 text-sm text-[#065F2F]">Sharing...</p>}
              <input aria-label="News sharing link" readOnly value={buildShareUrl(shareItem)} onFocus={(event) => event.target.select()} className="mt-4 w-full rounded-lg border border-[#C9F5DC] p-3 text-xs text-slate-600" />
              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                On supported mobile devices, the More option will also try to
                attach the news picture directly.
              </p>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};

export default News;