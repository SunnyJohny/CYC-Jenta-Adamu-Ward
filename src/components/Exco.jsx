import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaUserTie, FaPlus, FaEdit, FaTrash, FaTimes, FaPlayCircle, FaUsers } from "react-icons/fa";
import { toast } from "react-toastify";
import { useMyContext } from "../Context/MyContext";
const EMPTY_MEMBERS = [];
const PHOTO_LIMIT = 10 * 1024 * 1024;
const VIDEO_LIMIT = 100 * 1024 * 1024;
const INPUT_CLASS = "w-full rounded-xl border border-[#C9F5DC] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]";
const BUTTON_CLASS = "inline-flex items-center justify-center gap-2 rounded-full bg-[#065F2F] px-5 py-3 font-bold text-white transition hover:bg-[#0B7A3E] disabled:cursor-not-allowed disabled:opacity-60";
const initialForm = () => ({
  name: "",
  position: "",
  tenure: "",
  bio: "",
  displayOrder: "0",
  status: "published"
});
const orderValue = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};
const validateMedia = (file, type) => {
  if (!file) return;
  const prefix = type === "photo" ? "image/" : "video/";
  const limit = type === "photo" ? PHOTO_LIMIT : VIDEO_LIMIT;
  if (!file.type.startsWith(prefix)) {
    throw new Error(type === "photo" ? "Please choose an image for the photograph." : "Please choose a video file.");
  }
  if (file.size > limit) {
    throw new Error(type === "photo" ? "The photograph must be 10MB or smaller." : "The video must be 100MB or smaller.");
  }
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
const Exco = () => {
  const {
    currentUser,
    canEditContribution,
    addExecutive,
    updateExecutive,
    deleteExecutive,
    executives = EMPTY_MEMBERS,
    loading,
    profileLoading,
    listenerErrors = {}
  } = useMyContext();
  const canContribute = Boolean(currentUser?.uid);
  const canEdit = member => canEditContribution(member);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [photoFile, setPhotoFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [videoPreview, setVideoPreview] = useState("");
  const [savedPhoto, setSavedPhoto] = useState({
    url: "",
    publicId: ""
  });
  const [savedVideo, setSavedVideo] = useState({
    url: "",
    publicId: ""
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saveStage, setSaveStage] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [failedPhotos, setFailedPhotos] = useState([]);
  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const formRef = useRef(null);
  const dialogRef = useRef(null);
  const objectUrlsRef = useRef(new Set());
  const uploadCacheRef = useRef({
    photo: null,
    video: null
  });
  const xhrRef = useRef(null);
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const accessRef = useRef(null);
  accessRef.current = {
    allowed: canContribute,
    uid: currentUser?.uid
  };
  const busy = saving || Boolean(deletingId);
  const previewPhoto = photoPreview || savedPhoto.url;
  const previewVideo = videoPreview || savedVideo.url;
  const members = useMemo(() => executives.filter(member => canEditContribution(member) || member.status === "published").slice().sort((a, b) => orderValue(a.displayOrder) - orderValue(b.displayOrder) || String(a.name || "").localeCompare(String(b.name || ""))), [executives, canEditContribution]);
  const selectedMember = members.find(member => member.id === selectedMemberId) || null;
  const modalOpen = Boolean(selectedMember);
  useEffect(() => {
    mountedRef.current = true;
    const urls = objectUrlsRef.current;
    return () => {
      mountedRef.current = false;
      xhrRef.current?.abort();
      urls.forEach(url => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);
  useEffect(() => {
    xhrRef.current?.abort();
    setShowForm(false);
  }, [currentUser?.uid]);
  useEffect(() => {
    if (!modalOpen) return undefined;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector("button")?.focus();
    const onKeyDown = event => {
      if (event.key === "Escape") {
        setSelectedMemberId(null);
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
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [modalOpen, selectedMemberId]);
  const releaseUrl = url => {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  };
  const resetForm = () => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
    uploadCacheRef.current = {
      photo: null,
      video: null
    };
    setForm(initialForm());
    setEditingId(null);
    setPhotoFile(null);
    setVideoFile(null);
    setPhotoPreview("");
    setVideoPreview("");
    setSavedPhoto({
      url: "",
      publicId: ""
    });
    setSavedVideo({
      url: "",
      publicId: ""
    });
    setUploadProgress(0);
    setSaveStage("");
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
    if (videoInputRef.current) {
      videoInputRef.current.value = "";
    }
  };
  const closeForm = () => {
    if (busyRef.current) return;
    resetForm();
    setShowForm(false);
  };
  const openForm = (member = null) => {
    if (!canContribute || busyRef.current || member && !canEdit(member)) return;
    resetForm();
    if (member) {
      setEditingId(member.id);
      setForm({
        name: member.name || "",
        position: member.position || "",
        tenure: member.tenure || "",
        bio: member.bio || "",
        displayOrder: String(orderValue(member.displayOrder)),
        status: member.status === "published" ? "published" : "draft"
      });
      setSavedPhoto({
        url: member.photoUrl || "",
        publicId: member.photoPublicId || ""
      });
      setSavedVideo({
        url: member.videoUrl || "",
        publicId: member.videoPublicId || ""
      });
    }
    setShowForm(true);
    window.requestAnimationFrame(() => {
      if (!formRef.current) return;
      const headerHeight = document.querySelector("header")?.getBoundingClientRect().height || 120;
      window.scrollTo({
        top: Math.max(0, formRef.current.getBoundingClientRect().top + window.scrollY - headerHeight - 16),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
      formRef.current.querySelector("input")?.focus({
        preventScroll: true
      });
    });
  };
  const handleChange = event => {
    const {
      name,
      value
    } = event.target;
    setForm(previous => ({
      ...previous,
      [name]: value
    }));
  };
  const selectFile = (event, type) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busyRef.current) return;
    try {
      validateMedia(file, type);
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      uploadCacheRef.current[type] = null;
      if (type === "photo") {
        releaseUrl(photoPreview);
        setPhotoFile(file);
        setPhotoPreview(url);
      } else {
        releaseUrl(videoPreview);
        setVideoFile(file);
        setVideoPreview(url);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };
  const removeMedia = type => {
    if (busyRef.current) return;
    uploadCacheRef.current[type] = null;
    if (type === "photo") {
      releaseUrl(photoPreview);
      setPhotoFile(null);
      setPhotoPreview("");
      setSavedPhoto({
        url: "",
        publicId: ""
      });
    } else {
      releaseUrl(videoPreview);
      setVideoFile(null);
      setVideoPreview("");
      setSavedVideo({
        url: "",
        publicId: ""
      });
    }

    // Removes the profile reference; remote assets are retained.
  };
  const uploadMedia = (file, type) => new Promise((resolve, reject) => {
    const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) {
      console.error("CYC EXCO: missing Cloudinary upload configuration.");
      reject(new Error("Uploads are not configured yet. Please contact the site administrator."));
      return;
    }
    const resourceType = type === "photo" ? "image" : "video";
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", preset);
    body.append("folder", `cyc/jenta-adamu-ward/exco/${resourceType}`);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`);
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
          resolve({
            url: result.secure_url,
            publicId: result.public_id || ""
          });
        } else {
          console.error("CYC EXCO upload:", result?.error?.message);
          reject(new Error("The file could not be uploaded. Please check its size and try again."));
        }
      } catch (error) {
        console.error("CYC EXCO upload response:", error);
        reject(new Error("The upload did not finish correctly. Please try again."));
      }
    };
    xhr.onerror = () => reject(new Error("Please check your internet connection and retry the upload."));
    xhr.ontimeout = () => reject(new Error("The upload took too long. Please try a smaller file or a stronger connection."));
    xhr.onabort = () => reject(new Error("The upload was interrupted. Please try again."));
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
    if (busyRef.current) return;
    if (!currentUser || !canContribute) {
      toast.error("Please sign in to add an EXCO member.");
      return;
    }
    const displayOrder = Number(form.displayOrder);
    if (!form.name.trim() || !form.position.trim()) {
      toast.error("Please enter the member's name and position.");
      return;
    }
    if (!Number.isSafeInteger(displayOrder) || displayOrder < 0) {
      toast.error("Display order must be a whole number of zero or more.");
      return;
    }
    busyRef.current = true;
    setSaving(true);
    const uid = currentUser.uid;
    let uploading = false;
    try {
      const media = {
        photo: savedPhoto,
        video: savedVideo
      };
      for (const [type, file] of [["photo", photoFile], ["video", videoFile]]) {
        assertAccess(uid);
        if (!file) continue;
        validateMedia(file, type);
        const cached = uploadCacheRef.current[type];
        if (cached?.file === file) {
          media[type] = cached.result;
          continue;
        }
        uploading = true;
        setSaveStage(type);
        setUploadProgress(0);
        const result = await uploadMedia(file, type);
        uploadCacheRef.current[type] = {
          file,
          result
        };
        media[type] = result;
        uploading = false;
      }
      assertAccess(uid);
      setSaveStage("saving");
      const payload = {
        name: form.name.trim(),
        position: form.position.trim(),
        tenure: form.tenure.trim(),
        bio: form.bio.trim(),
        displayOrder,
        status: form.status === "published" ? "published" : "draft",
        photoUrl: media.photo.url,
        photoPublicId: media.photo.publicId,
        videoUrl: media.video.url,
        videoPublicId: media.video.publicId
      };
      if (editingId) {
        await updateExecutive(editingId, payload);
      } else {
        await addExecutive(payload);
      }
      if (!mountedRef.current) return;
      toast.success(editingId ? "EXCO profile updated." : "EXCO member added.");
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error("CYC EXCO save:", error);
      if (mountedRef.current) {
        toast.error(uploading ? error.message : "We couldn't save this profile. Please check your connection and sign-in, then try again.");
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setSaving(false);
        setSaveStage("");
        setUploadProgress(0);
      }
    }
  };
  const handleDelete = async member => {
    if (busyRef.current || !canContribute || !currentUser || !canEdit(member)) {
      return;
    }
    if (!window.confirm(`Remove ${member.name || "this member"}'s profile from the website?`)) {
      return;
    }
    busyRef.current = true;
    setDeletingId(member.id);
    try {
      assertAccess(currentUser.uid);
      await deleteExecutive(member.id);
      if (!mountedRef.current) return;
      if (editingId === member.id) {
        resetForm();
        setShowForm(false);
      }
      if (selectedMemberId === member.id) {
        setSelectedMemberId(null);
      }
      toast.success("EXCO profile removed.");
    } catch (error) {
      console.error("CYC EXCO delete:", error);
      if (mountedRef.current) {
        toast.error("We couldn't remove this profile. Please try again.");
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setDeletingId(null);
      }
    }
  };
  const markPhotoFailed = url => setFailedPhotos(previous => previous.includes(url) ? previous : [...previous, url]);
  return <section id="exco" aria-labelledby="cyc-exco-heading" className="scroll-mt-40 bg-white px-4 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#0B7A3E]">
            Meet the Leadership
          </p>

          <h2 id="cyc-exco-heading" className="mb-4 text-3xl font-extrabold text-[#065F2F] md:text-5xl">
            Our Executive Council
          </h2>

          <p className="mx-auto max-w-2xl leading-relaxed text-slate-600">
            Meet the people serving CYC Jenta Adamu Ward
            and working with young people for community
            development.
          </p>

          <div className="mx-auto mt-5 h-1 w-20 rounded-full bg-[#F2B705]" />
        </div>

        {canContribute && <div className="mb-6 flex justify-end">
            <button type="button" onClick={() => showForm ? closeForm() : openForm()} disabled={busy} className={BUTTON_CLASS}>
              {showForm ? <FaTimes /> : <FaPlus />}

              {showForm ? "Close Form" : "Add EXCO Member"}
            </button>
          </div>}

        {canContribute && showForm && <form ref={formRef} onSubmit={handleSubmit} className="mb-10 rounded-3xl border border-[#C9F5DC] bg-[#E9FFF3] p-5 md:p-8">
            <h3 className="mb-6 text-xl font-extrabold text-[#065F2F]">
              {editingId ? "Edit EXCO Profile" : "Add EXCO Member"}
            </h3>

            <fieldset disabled={busy}>
              <div className="grid gap-5 md:grid-cols-2">
                {[{
              name: "name",
              label: "Full name *",
              required: true
            }, {
              name: "position",
              label: "Position / office *",
              required: true
            }, {
              name: "tenure",
              label: "Tenure (optional)"
            }, {
              name: "displayOrder",
              label: "Display order",
              type: "number"
            }].map(field => <FormField key={field.name} label={field.label} id={`exco-${field.name}`}>
                    <input id={`exco-${field.name}`} name={field.name} type={field.type || "text"} required={field.required} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? 1 : undefined} value={form[field.name]} onChange={handleChange} className={INPUT_CLASS} />
                  </FormField>)}

                <FormField label="Publication status" id="exco-status">
                  <select id="exco-status" name="status" value={form.status} onChange={handleChange} className={INPUT_CLASS}>
                    <option value="published">
                      Published
                    </option>

                    <option value="draft">
                      Draft
                    </option>
                  </select>

                  <p className="mt-2 text-xs text-slate-600">
                    Lower display numbers appear first.
                    Drafts are visible to their author and administrators.
                  </p>
                </FormField>

                <FormField label="Biography / introduction" id="exco-bio" className="md:col-span-2">
                  <textarea id="exco-bio" name="bio" rows={5} value={form.bio} onChange={handleChange} className={INPUT_CLASS} placeholder="Add an approved introduction, responsibilities or message." />
                </FormField>

                <FormField label="Photograph (optional)" id="exco-photo">
                  <input id="exco-photo" ref={photoInputRef} type="file" accept="image/*" onChange={event => selectFile(event, "photo")} className={INPUT_CLASS} />

                  <p className="mt-2 text-xs text-slate-600">
                    Choose a clear portrait. Maximum 10MB.
                  </p>

                  {previewPhoto && <div className="mt-3">
                      <img src={previewPhoto} alt="Selected member portrait" className="h-52 w-44 rounded-xl border border-[#C9F5DC] object-cover object-top" />

                      <button type="button" onClick={() => removeMedia("photo")} className="mt-2 text-sm font-bold text-red-600">
                        Remove photograph
                      </button>
                    </div>}
                </FormField>

                <FormField label="Related video (optional)" id="exco-video">
                  <input id="exco-video" ref={videoInputRef} type="file" accept="video/*" onChange={event => selectFile(event, "video")} className={INPUT_CLASS} />

                  <p className="mt-2 text-xs text-slate-600">
                    One introduction, speech or related
                    video. Maximum 100MB.
                  </p>

                  {previewVideo && <div className="mt-3">
                      <video key={previewVideo} src={previewVideo} controls playsInline preload="metadata" className="max-h-60 w-full rounded-xl bg-black" />

                      <button type="button" onClick={() => removeMedia("video")} className="mt-2 text-sm font-bold text-red-600">
                        Remove video
                      </button>
                    </div>}
                </FormField>
              </div>
            </fieldset>

            {saving && <div className="mt-5" role="status" aria-live="polite">
                {saveStage !== "saving" && <progress max="100" value={uploadProgress} className="h-3 w-full" />}

                <p className="mt-2 text-sm font-semibold text-[#065F2F]">
                  {saveStage === "saving" ? "Saving profile…" : uploadProgress === 100 ? "Finishing file upload…" : `Uploading ${saveStage === "video" ? "video" : "photograph"}… ${uploadProgress}%`}
                </p>
              </div>}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={busy} className={BUTTON_CLASS}>
                {saving ? "Saving…" : editingId ? "Update Profile" : "Save EXCO Member"}
              </button>

              <button type="button" onClick={closeForm} disabled={busy} className="rounded-full border border-[#065F2F] px-5 py-3 font-bold text-[#065F2F] disabled:opacity-50">
                Cancel
              </button>
            </div>
          </form>}

        {listenerErrors.executives ? <p role="status" className="rounded-2xl bg-slate-50 p-8 text-center text-slate-600">
            We couldn&apos;t load the executive profiles.
            Please try again later.
          </p> : loading || profileLoading ? <p role="status" className="py-10 text-center text-slate-600">
            Loading executive profiles…
          </p> : !members.length ? <div className="rounded-3xl border border-dashed border-[#C9F5DC] bg-[#E9FFF3] px-6 py-12 text-center">
            <FaUsers className="mx-auto mb-4 text-4xl text-[#0B7A3E]" />

            <h3 className="mb-2 text-xl font-extrabold text-[#065F2F]">
              Executive profiles will appear here
            </h3>

            <p className="text-sm text-slate-600">
              The council&apos;s approved leadership
              profiles will be displayed once published.
            </p>
          </div> : <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {members.map(member => <article key={member.id} className="flex flex-col overflow-hidden rounded-2xl border border-[#C9F5DC] bg-white shadow-sm">
                <button type="button" onClick={() => setSelectedMemberId(member.id)} aria-label={`View ${member.name || "member"}'s profile`} className="relative block aspect-[4/5] w-full overflow-hidden bg-[#E9FFF3]">
                  {member.photoUrl && !failedPhotos.includes(member.photoUrl) ? <img src={member.photoUrl} alt={member.name || "Executive council member"} loading="lazy" onError={() => markPhotoFailed(member.photoUrl)} className="h-full w-full object-cover object-top" /> : <span className="flex h-full w-full items-center justify-center">
                      <FaUserTie className="text-7xl text-[#0B7A3E]/60" />
                    </span>}

                  {member.videoUrl && <span className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full bg-[#065F2F] px-3 py-1.5 text-xs font-bold text-white">
                      <FaPlayCircle />
                      Video
                    </span>}
                </button>

                <div className="flex flex-1 flex-col p-5">
                  <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[#0B7A3E]">
                    {member.position || "Council Member"}
                  </p>

                  <h3 className="text-xl font-extrabold text-[#065F2F]">
                    {member.name || "Council Member"}
                  </h3>

                  {member.tenure && <p className="mt-2 text-sm text-slate-500">
                      {member.tenure}
                    </p>}

                  {member.bio && <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {member.bio.length > 150 ? `${member.bio.slice(0, 150)}…` : member.bio}
                    </p>}

                  <button type="button" onClick={() => setSelectedMemberId(member.id)} className="mt-auto pt-5 text-left text-sm font-bold text-[#065F2F] hover:underline">
                    View Profile
                    {member.videoUrl ? " & Video" : ""}
                  </button>

                  {canEdit(member) && <div className="mt-4 border-t border-[#C9F5DC] pt-4">
                      <span className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-bold capitalize ${member.status === "published" ? "bg-green-50 text-green-800" : "bg-yellow-50 text-yellow-800"}`}>
                        {member.status || "draft"}
                      </span>

                      <div className="flex gap-4">
                        <button type="button" disabled={busy} onClick={() => openForm(member)} className="inline-flex items-center gap-2 text-sm font-bold text-[#065F2F] disabled:opacity-50">
                          <FaEdit />
                          Edit
                        </button>

                        <button type="button" disabled={busy} onClick={() => handleDelete(member)} className="inline-flex items-center gap-2 text-sm font-bold text-red-600 disabled:opacity-50">
                          <FaTrash />
                          {deletingId === member.id ? "Removing…" : "Delete"}
                        </button>
                      </div>
                    </div>}
                </div>
              </article>)}
          </div>}
      </div>

      {selectedMember && <div onClick={event => {
      if (event.target === event.currentTarget) {
        setSelectedMemberId(null);
      }
    }} className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-6">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="exco-profile-title" className="relative my-auto max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl md:p-8">
            <button type="button" onClick={() => setSelectedMemberId(null)} aria-label="Close executive profile" className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#E9FFF3] text-[#065F2F]">
              <FaTimes />
            </button>

            <div className="flex flex-col gap-6 pr-8 sm:flex-row sm:items-start">
              {selectedMember.photoUrl && !failedPhotos.includes(selectedMember.photoUrl) ? <img src={selectedMember.photoUrl} alt={selectedMember.name || "Executive council member"} onError={() => markPhotoFailed(selectedMember.photoUrl)} className="h-56 w-44 shrink-0 rounded-2xl object-cover object-top" /> : <div className="flex h-48 w-40 shrink-0 items-center justify-center rounded-2xl bg-[#E9FFF3]">
                  <FaUserTie className="text-6xl text-[#0B7A3E]" />
                </div>}

              <div>
                <p className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[#0B7A3E]">
                  {selectedMember.position || "Council Member"}
                </p>

                <h3 id="exco-profile-title" className="text-2xl font-extrabold text-[#065F2F] md:text-3xl">
                  {selectedMember.name || "Council Member"}
                </h3>

                {selectedMember.tenure && <p className="mt-3 text-sm text-slate-500">
                    {selectedMember.tenure}
                  </p>}

                <p className="mt-4 text-sm text-slate-500">
                  CYC Jenta Adamu Ward
                </p>
              </div>
            </div>

            {selectedMember.bio && <p className="mt-6 whitespace-pre-line leading-relaxed text-slate-700">
                {selectedMember.bio}
              </p>}

            {selectedMember.videoUrl && <div className="mt-6">
                <h4 className="mb-3 text-lg font-bold text-[#065F2F]">
                  Related Video
                </h4>

                <video key={selectedMember.videoUrl} src={selectedMember.videoUrl} poster={selectedMember.photoUrl || undefined} controls playsInline preload="metadata" tabIndex={0} className="max-h-[65vh] w-full rounded-2xl bg-black">
                  Your browser does not support embedded
                  video.
                </video>
              </div>}
          </div>
        </div>}
    </section>;
};
export default Exco;
