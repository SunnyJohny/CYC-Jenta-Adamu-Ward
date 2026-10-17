import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { motion, useReducedMotion } from "framer-motion";

import {
  FaBookOpen,
  FaUsers,
  FaBullhorn,
  FaChartLine,
  FaPlus,
  FaTimes,
  FaEdit,
  FaTrash,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaUserTie,
  FaProjectDiagram,
  FaImage,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

import { toast } from "react-toastify";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase";

import {
  CYC_COLLECTION,
  CYC_ID,
  useMyContext,
} from "../Context/MyContext";

const EMPTY_PROJECTS = [];
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const INPUT_CLASS =
  "w-full rounded-xl border border-[#C9F5DC] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A3E]";

const BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#065F2F] px-5 py-3 font-bold text-white transition hover:bg-[#0B7A3E] disabled:cursor-not-allowed disabled:opacity-60";

const FOCUS_AREAS = [
  {
    icon: FaUsers,
    title: "Youth Unity",
    description:
      "Encouraging friendship, inclusion and peaceful coexistence among young people in the community.",
  },
  {
    icon: FaBookOpen,
    title: "Education & Skills",
    description:
      "Supporting learning, practical skills and opportunities for personal development.",
  },
  {
    icon: FaChartLine,
    title: "Self-Reliance",
    description:
      "Encouraging enterprise, responsibility and the development of young people's potential.",
  },
  {
    icon: FaProjectDiagram,
    title: "Community Development",
    description:
      "Bringing people together to identify local needs and contribute to community projects.",
  },
  {
    icon: FaUserTie,
    title: "Leadership & Service",
    description:
      "Promoting discipline, responsible leadership and a commitment to serving others.",
  },
  {
    icon: FaBullhorn,
    title: "Youth Participation",
    description:
      "Creating space for young people to share ideas and take part in community affairs.",
  },
];

const initialForm = () => ({
  projectName: "",
  commissioningDate: "",
  commissionedBy: "",
  location: "Jenta Adamu Ward",
  category: "Community Development",
  projectStatus: "completed",
  description: "",
  status: "published",
});

const getProjectImages = (project) => {
  const images = Array.isArray(project?.projectImages)
    ? project.projectImages.filter(
        (url) => typeof url === "string" && url.trim()
      )
    : [];

  const fallback = project?.coverImage || project?.imageUrl;

  return [
    ...new Set(
      images.length ? images : fallback ? [fallback] : []
    ),
  ].slice(0, MAX_IMAGES);
};

const projectTitle = (project) =>
  project.title ||
  project.projectName ||
  "Community project";

const projectLocation = (project) =>
  project.location ||
  project.lga ||
  "Jenta Adamu Ward";

const formatDate = (value) => {
  if (!value) return "Not specified";

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(
          typeof value === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? `${value}T12:00:00`
            : value
        );

  return Number.isNaN(date.getTime())
    ? "Not specified"
    : date.toLocaleDateString("en-NG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
};

const Field = ({
  label,
  htmlFor,
  children,
  className = "",
}) => (
  <div className={className}>
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-bold text-slate-700"
    >
      {label}
    </label>

    {children}
  </div>
);

const AboutUs = () => {
  const {
    currentUser,
    canManageContent = false,
    cycProfile,
    projects = EMPTY_PROJECTS,
    loading,
    profileLoading,
    listenerErrors = {},
  } = useMyContext();

  const reduceMotion = useReducedMotion();

  const fileInputRef = useRef(null);
  const previewDialogRef = useRef(null);
  const previewUrlsRef = useRef(new Set());
  const uploadCacheRef = useRef(new Map());
  const requestRef = useRef(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const permissionRef = useRef(canManageContent);

  permissionRef.current = canManageContent;

  const [openInfoCard, setOpenInfoCard] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editingProject, setEditingProject] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageFiles, setImageFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const busy = submitting || Boolean(deletingId);

  useEffect(() => {
    mountedRef.current = true;

    const urls = previewUrlsRef.current;

    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();

      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const visibleProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          canManageContent || project.status === "published"
      ),
    [projects, canManageContent]
  );

  const locations = useMemo(
    () =>
      [...new Set(visibleProjects.map(projectLocation))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [visibleProjects]
  );

  const filteredProjects = useMemo(
    () =>
      selectedLocation
        ? visibleProjects.filter(
            (project) =>
              projectLocation(project) === selectedLocation
          )
        : visibleProjects,
    [visibleProjects, selectedLocation]
  );

  const publishedCount = projects.filter(
    (project) => project.status === "published"
  ).length;

  const safePreview =
    imagePreview &&
    (canManageContent ||
      imagePreview.project.status === "published")
      ? imagePreview
      : null;

  useEffect(() => {
    if (
      selectedLocation &&
      !locations.includes(selectedLocation)
    ) {
      setSelectedLocation("");
    }
  }, [locations, selectedLocation]);

  useEffect(() => {
    if (!safePreview) return undefined;

    const dialog = previewDialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    dialog?.querySelector("button")?.focus();

    const handleKey = (event) => {
      if (event.key === "Escape") {
        setImagePreview(null);
      }

      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight"
      ) {
        event.preventDefault();

        const direction =
          event.key === "ArrowLeft" ? -1 : 1;

        setPreviewIndex(
          (previous) =>
            (previous +
              direction +
              safePreview.images.length) %
            safePreview.images.length
        );
      }

      if (event.key === "Tab" && dialog) {
        const buttons = Array.from(
          dialog.querySelectorAll("button:not([disabled])")
        );

        const first = buttons[0];
        const last = buttons[buttons.length - 1];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [safePreview]);

  const scrollToId = (id) => {
    const target = document.getElementById(id);

    if (!target) return;

    const offset =
      (document
        .querySelector("header")
        ?.getBoundingClientRect().height || 120) + 16;

    window.scrollTo({
      top: Math.max(
        0,
        target.getBoundingClientRect().top +
          window.scrollY -
          offset
      ),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  const releasePreview = (url) => {
    URL.revokeObjectURL(url);
    previewUrlsRef.current.delete(url);
  };

  const resetForm = () => {
    previewUrlsRef.current.forEach((url) =>
      URL.revokeObjectURL(url)
    );

    previewUrlsRef.current.clear();
    uploadCacheRef.current.clear();

    setForm(initialForm());
    setEditingProject(null);
    setImageFiles([]);
    setExistingImages([]);
    setUploadProgress(0);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const closeForm = () => {
    if (busyRef.current) return;

    resetForm();
    setShowForm(false);
  };

  const openProjectForm = (project = null) => {
    if (!canManageContent || busyRef.current) return;

    resetForm();

    if (project) {
      setEditingProject(project);

      setForm({
        projectName: projectTitle(project),
        commissioningDate:
          project.commissioningDate ||
          project.startDate ||
          "",
        commissionedBy: project.commissionedBy || "",
        location: projectLocation(project),
        category:
          project.category || "Community Development",
        projectStatus: project.projectStatus || "completed",
        description: project.description || "",
        status: project.status || "draft",
      });

      setExistingImages(getProjectImages(project));
    }

    setShowForm(true);

    window.requestAnimationFrame(() =>
      scrollToId("cyc-project-form")
    );
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleFiles = (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = "";

    if (!selected.length || busyRef.current) return;

    const available =
      MAX_IMAGES - existingImages.length - imageFiles.length;

    if (available <= 0) {
      toast.info(
        `A project can have up to ${MAX_IMAGES} pictures.`
      );
      return;
    }

    const unique = selected.filter((file, index, list) => {
      const matches = (other) =>
        other.name === file.name &&
        other.size === file.size &&
        other.lastModified === file.lastModified;

      return (
        !imageFiles.some((item) => matches(item.file)) &&
        list.findIndex(matches) === index
      );
    });

    const accepted = unique.slice(0, available);

    if (
      accepted.some(
        (file) => !file.type.startsWith("image/")
      )
    ) {
      toast.error("Please choose image files only.");
      return;
    }

    if (
      accepted.some((file) => file.size > MAX_IMAGE_SIZE)
    ) {
      toast.error("Each picture must be 10MB or smaller.");
      return;
    }

    if (unique.length > available) {
      toast.info(
        `Only ${available} more picture${
          available === 1 ? "" : "s"
        } can be added.`
      );
    }

    const mapped = accepted.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);

      return {
        file,
        previewUrl,
        id: previewUrl,
      };
    });

    setImageFiles((previous) => [...previous, ...mapped]);
  };

  const removeNewImage = (item) => {
    if (busyRef.current) return;

    releasePreview(item.previewUrl);
    uploadCacheRef.current.delete(item.id);

    setImageFiles((previous) =>
      previous.filter((file) => file.id !== item.id)
    );
  };

  const uploadImage = (file, onProgress) =>
    new Promise((resolve, reject) => {
      const cloudName =
        process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;

      const uploadPreset =
        process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        console.error(
          "CYC upload configuration is missing."
        );

        reject(
          new Error(
            "Picture uploads are not configured yet. Please contact the site administrator."
          )
        );
        return;
      }

      const body = new FormData();

      body.append("file", file);
      body.append("upload_preset", uploadPreset);
      body.append(
        "folder",
        "cyc/jenta-adamu-ward/projects"
      );

      const xhr = new XMLHttpRequest();
      requestRef.current = xhr;

      xhr.open(
        "POST",
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
      );

      xhr.timeout = 120000;

      xhr.upload.onprogress = (event) => {
        if (
          event.lengthComputable &&
          mountedRef.current
        ) {
          onProgress(event.loaded / event.total);
        }
      };

      xhr.onload = () => {
        try {
          const response = JSON.parse(xhr.responseText);

          if (
            xhr.status >= 200 &&
            xhr.status < 300 &&
            response.secure_url
          ) {
            resolve(response.secure_url);
          } else {
            console.error(
              "CYC image upload rejected:",
              response?.error?.message
            );

            reject(
              new Error(
                "A picture could not be uploaded. Please try again."
              )
            );
          }
        } catch (error) {
          console.error(
            "CYC upload response:",
            error
          );

          reject(
            new Error(
              "The upload did not finish correctly. Please try again."
            )
          );
        }
      };

      xhr.onerror = () =>
        reject(
          new Error(
            "Please check your internet connection and try uploading again."
          )
        );

      xhr.ontimeout = () =>
        reject(
          new Error(
            "The upload took too long. Please try again."
          )
        );

      xhr.onabort = () =>
        reject(
          new Error(
            "The picture upload was interrupted."
          )
        );

      xhr.onloadend = () => {
        if (requestRef.current === xhr) {
          requestRef.current = null;
        }
      };

      xhr.send(body);
    });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (busyRef.current) return;

    if (!currentUser || !canManageContent) {
      toast.error(
        "Only council administrators can save projects."
      );
      return;
    }

    if (
      !form.projectName.trim() ||
      !form.location.trim()
    ) {
      toast.error(
        "Please enter the project name and location."
      );
      return;
    }

    if (
      existingImages.length + imageFiles.length >
      MAX_IMAGES
    ) {
      toast.error(
        `A project can have up to ${MAX_IMAGES} pictures.`
      );
      return;
    }

    busyRef.current = true;
    setSubmitting(true);
    setUploadProgress(0);

    let uploadFailed = false;

    try {
      const newUrls = [];

      for (
        let index = 0;
        index < imageFiles.length;
        index += 1
      ) {
        if (!mountedRef.current) return;

        if (!permissionRef.current) {
          throw new Error(
            "Your administrator access has changed."
          );
        }

        const item = imageFiles[index];
        let url = uploadCacheRef.current.get(item.id);

        if (!url) {
          try {
            url = await uploadImage(
              item.file,
              (fraction) => {
                setUploadProgress(
                  Math.round(
                    ((index + fraction) /
                      imageFiles.length) *
                      100
                  )
                );
              }
            );
          } catch (error) {
            uploadFailed = true;
            throw error;
          }

          uploadCacheRef.current.set(item.id, url);
        }

        newUrls.push(url);

        if (mountedRef.current) {
          setUploadProgress(
            Math.round(
              ((index + 1) / imageFiles.length) * 100
            )
          );
        }
      }

      if (!mountedRef.current) return;

      if (!permissionRef.current) {
        throw new Error(
          "Your administrator access has changed."
        );
      }

      const projectImages = [
        ...existingImages,
        ...newUrls,
      ];

      const payload = {
        title: form.projectName.trim(),
        projectName: form.projectName.trim(),
        commissioningDate: form.commissioningDate,
        startDate: form.commissioningDate,
        commissionedBy: form.commissionedBy.trim(),
        location: form.location.trim(),
        category:
          form.category.trim() || "Community Development",
        projectStatus: form.projectStatus,
        description: form.description.trim(),
        status: form.status,
        projectImages,
        coverImage: projectImages[0] || "",
        imageUrl: projectImages[0] || "",
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
        updatedByName:
          currentUser.displayName ||
          currentUser.email ||
          "",
      };

      // Preserve the original multi-picture project fields.
      if (editingProject) {
        await updateDoc(
          doc(
            db,
            CYC_COLLECTION,
            CYC_ID,
            "projects",
            editingProject.id
          ),
          payload
        );
      } else {
        await addDoc(
          collection(
            db,
            CYC_COLLECTION,
            CYC_ID,
            "projects"
          ),
          {
            ...payload,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
            createdByName:
              currentUser.displayName ||
              currentUser.email ||
              "",
          }
        );
      }

      if (!mountedRef.current) return;

      toast.success(
        editingProject
          ? "Project updated successfully."
          : "Project added successfully."
      );

      setSelectedLocation("");
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error("CYC project save:", error);

      if (mountedRef.current) {
        toast.error(
          uploadFailed
            ? error.message
            : "We couldn't save this project. Please check your connection and administrator access, then try again."
        );
      }
    } finally {
      busyRef.current = false;

      if (mountedRef.current) {
        setSubmitting(false);
        setUploadProgress(0);
      }
    }
  };

  const handleDelete = async (project) => {
    if (
      busyRef.current ||
      !canManageContent ||
      !currentUser
    ) {
      return;
    }

    if (
      !window.confirm(
        `Delete "${projectTitle(
          project
        )}"? This removes its project record.`
      )
    ) {
      return;
    }

    busyRef.current = true;
    setDeletingId(project.id);

    try {
      await deleteDoc(
        doc(
          db,
          CYC_COLLECTION,
          CYC_ID,
          "projects",
          project.id
        )
      );

      if (!mountedRef.current) return;

      if (editingProject?.id === project.id) {
        resetForm();
        setShowForm(false);
      }

      toast.success("Project deleted successfully.");
    } catch (error) {
      console.error("CYC project delete:", error);

      if (mountedRef.current) {
        toast.error(
          "We couldn't delete this project. Please try again."
        );
      }
    } finally {
      busyRef.current = false;

      if (mountedRef.current) {
        setDeletingId(null);
      }
    }
  };

  const openPreview = (project, index = 0) => {
    const images = getProjectImages(project);

    if (!images.length) return;

    setPreviewIndex(
      Math.max(0, Math.min(index, images.length - 1))
    );

    setImagePreview({
      project,
      images,
    });
  };

  return (
    <section
      id="about"
      className="bg-[#E9FFF3] px-4 py-16 text-gray-800 md:px-8 md:py-20"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#0B7A3E]">
            About the Council
          </p>

          <h2 className="mb-3 text-3xl font-extrabold text-[#065F2F] md:text-5xl">
            {cycProfile?.title || "Central Youth Council"}
          </h2>

          <p className="font-semibold text-[#0B7A3E]">
            Jenta Adamu Ward · Jos North · Plateau State
          </p>

          <div className="mx-auto mt-5 h-1 w-20 rounded-full bg-[#F2B705]" />
        </div>

        <div className="mb-16 grid items-center gap-10 lg:grid-cols-2">
          <div className="rounded-3xl bg-[#065F2F] px-6 py-10 text-center shadow-lg">
            <img
              src={
                cycProfile?.logoUrl ||
                "/images/cyclogo.png"
              }
              alt="Plateau State Youth Council emblem"
              className="mx-auto mb-6 h-48 w-48 object-contain sm:h-60 sm:w-60"
            />

            <p className="text-lg font-bold text-white">
              {cycProfile?.slogan ||
                "Build the Youth, Build the Nation"}
            </p>

            <p className="mt-2 text-sm text-white/80">
              Working together for our community
            </p>
          </div>

          <div>
            <h3 className="mb-5 text-3xl font-extrabold text-[#065F2F]">
              United for Youth and Community Development
            </h3>

            <p className="mb-5 whitespace-pre-line text-lg leading-relaxed text-slate-700">
              {cycProfile?.description ||
                "The Central Youth Council brings together young people in Jenta Adamu Ward to encourage unity, self-reliance and community participation."}
            </p>

            <p className="mb-6 leading-relaxed text-slate-600">
              Through shared ideas, responsible leadership
              and service, the council creates a platform
              for young people to contribute to the growth
              of their community.
            </p>

            {cycProfile?.history && (
              <p className="mb-6 whitespace-pre-line leading-relaxed text-slate-600">
                {cycProfile.history}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                {
                  key: "community",
                  heading: "Our Community",
                  detail: "Jenta Adamu Ward",
                },
                {
                  key: "focus",
                  heading: "Our Focus",
                  detail: "Youth development",
                },
                {
                  key: "projects",
                  heading: String(publishedCount),
                  detail: "Published projects",
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    item.key === "projects"
                      ? scrollToId("projects")
                      : setOpenInfoCard((previous) =>
                          previous === item.key
                            ? null
                            : item.key
                        )
                  }
                  aria-expanded={
                    item.key === "projects"
                      ? undefined
                      : openInfoCard === item.key
                  }
                  className="rounded-xl border border-[#C9F5DC] bg-white p-4 text-center shadow-sm transition hover:border-[#065F2F]"
                >
                  <span className="block text-lg font-extrabold text-[#065F2F]">
                    {item.heading}
                  </span>

                  <span className="mt-1 block text-xs text-slate-600">
                    {item.detail}
                  </span>
                </button>
              ))}
            </div>

            {openInfoCard && (
              <div className="mt-4 rounded-xl border border-[#C9F5DC] bg-white p-5">
                <h4 className="mb-2 font-extrabold text-[#065F2F]">
                  {openInfoCard === "community"
                    ? "Serving Jenta Adamu Ward"
                    : "Our Shared Priorities"}
                </h4>

                <p className="text-sm leading-relaxed text-slate-600">
                  {openInfoCard === "community"
                    ? "Our community is in Jos North, Plateau State. Project locations below are entered by council administrators as activities are added."
                    : "Youth unity, education, skills, self-reliance, responsible leadership and participation in community affairs."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div
          id="projects"
          className="mb-16 scroll-mt-40 rounded-3xl border border-[#C9F5DC] bg-white p-5 shadow-md md:p-8"
        >
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#0B7A3E]">
                Community Action
              </p>

              <h3 className="text-2xl font-extrabold text-[#065F2F] md:text-3xl">
                Projects & Activities
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Explore council projects, programmes and
                community activities.
              </p>
            </div>

            {canManageContent && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  showForm
                    ? closeForm()
                    : openProjectForm()
                }
                className={BUTTON_CLASS}
              >
                {showForm ? <FaTimes /> : <FaPlus />}
                {showForm ? "Close Form" : "Add Project"}
              </button>
            )}
          </div>

          <Field
            label="Filter by project location"
            htmlFor="cyc-location-filter"
            className="mb-6 max-w-md"
          >
            <select
              id="cyc-location-filter"
              value={selectedLocation}
              onChange={(event) =>
                setSelectedLocation(event.target.value)
              }
              className={INPUT_CLASS}
            >
              <option value="">
                All locations ({visibleProjects.length})
              </option>

              {locations.map((location) => (
                <option key={location} value={location}>
                  {location} (
                  {
                    visibleProjects.filter(
                      (project) =>
                        projectLocation(project) ===
                        location
                    ).length
                  }
                  )
                </option>
              ))}
            </select>
          </Field>

          {canManageContent && showForm && (
            <form
              id="cyc-project-form"
              onSubmit={handleSubmit}
              className="mb-8 scroll-mt-40 rounded-2xl border border-[#C9F5DC] bg-[#E9FFF3] p-5"
            >
              <h4 className="mb-5 text-xl font-extrabold text-[#065F2F]">
                {editingProject
                  ? "Edit Project"
                  : "Add Project or Activity"}
              </h4>

              <fieldset disabled={busy}>
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    {
                      name: "projectName",
                      label: "Project / activity name *",
                      required: true,
                    },
                    {
                      name: "location",
                      label: "Location / community unit *",
                      required: true,
                    },
                    {
                      name: "commissioningDate",
                      label: "Project date",
                      type: "date",
                    },
                    {
                      name: "commissionedBy",
                      label: "Led / commissioned by",
                    },
                    {
                      name: "category",
                      label: "Category",
                    },
                  ].map((field) => (
                    <Field
                      key={field.name}
                      label={field.label}
                      htmlFor={`cyc-${field.name}`}
                    >
                      <input
                        id={`cyc-${field.name}`}
                        name={field.name}
                        type={field.type || "text"}
                        required={field.required}
                        value={form[field.name]}
                        onChange={handleChange}
                        className={INPUT_CLASS}
                      />
                    </Field>
                  ))}

                  <Field
                    label="Project progress"
                    htmlFor="cyc-projectStatus"
                  >
                    <select
                      id="cyc-projectStatus"
                      name="projectStatus"
                      value={form.projectStatus}
                      onChange={handleChange}
                      className={INPUT_CLASS}
                    >
                      <option value="planned">
                        Planned
                      </option>
                      <option value="ongoing">
                        Ongoing
                      </option>
                      <option value="completed">
                        Completed
                      </option>
                    </select>
                  </Field>

                  <Field
                    label="Publication status"
                    htmlFor="cyc-status"
                  >
                    <select
                      id="cyc-status"
                      name="status"
                      value={form.status}
                      onChange={handleChange}
                      className={INPUT_CLASS}
                    >
                      <option value="published">
                        Published
                      </option>
                      <option value="draft">
                        Draft
                      </option>
                    </select>
                  </Field>

                  <Field
                    label="Project pictures"
                    htmlFor="cyc-project-pictures"
                  >
                    <input
                      id="cyc-project-pictures"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFiles}
                      className={INPUT_CLASS}
                    />

                    <p className="mt-2 text-xs text-slate-600">
                      Up to {MAX_IMAGES} pictures, 10MB each.
                    </p>
                  </Field>

                  <Field
                    label="Description"
                    htmlFor="cyc-description"
                    className="md:col-span-2"
                  >
                    <textarea
                      id="cyc-description"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      rows={5}
                      className={INPUT_CLASS}
                      placeholder="Describe the activity, its purpose and any confirmed outcomes."
                    />
                  </Field>
                </div>

                {(existingImages.length > 0 ||
                  imageFiles.length > 0) && (
                  <div className="mt-5">
                    <p className="mb-3 text-sm font-bold">
                      Pictures (
                      {existingImages.length +
                        imageFiles.length}
                      /{MAX_IMAGES})
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        ...existingImages.map((url) => ({
                          id: url,
                          url,
                          saved: true,
                        })),
                        ...imageFiles.map((item) => ({
                          ...item,
                          url: item.previewUrl,
                          saved: false,
                        })),
                      ].map((item, index) => (
                        <div
                          key={item.id}
                          className="relative overflow-hidden rounded-xl border bg-white"
                        >
                          <img
                            src={item.url}
                            alt={`Selected project picture ${
                              index + 1
                            }`}
                            className="h-28 w-full object-cover"
                          />

                          <button
                            type="button"
                            aria-label={`Remove picture ${
                              index + 1
                            }`}
                            onClick={() =>
                              item.saved
                                ? setExistingImages(
                                    (previous) =>
                                      previous.filter(
                                        (url) =>
                                          url !== item.url
                                      )
                                  )
                                : removeNewImage(item)
                            }
                            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white"
                          >
                            <FaTimes />
                          </button>

                          <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white">
                            {item.saved ? "Saved" : "New"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>

              {submitting && imageFiles.length > 0 && (
                <div className="mt-5" role="status">
                  <progress
                    max="100"
                    value={uploadProgress}
                    className="h-3 w-full"
                  />

                  <p className="mt-2 text-sm text-slate-600">
                    {uploadProgress < 100
                      ? `Uploading pictures… ${uploadProgress}%`
                      : "Pictures uploaded. Saving project…"}
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={busy}
                  className={BUTTON_CLASS}
                >
                  {submitting
                    ? "Saving…"
                    : editingProject
                      ? "Update Project"
                      : "Save Project"}
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={closeForm}
                  className="rounded-full border border-[#065F2F] px-5 py-3 font-bold text-[#065F2F] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {listenerErrors.projects ? (
            <p
              role="status"
              className="rounded-xl bg-slate-50 p-6 text-center text-slate-600"
            >
              We couldn&apos;t load the projects. Please
              try again later.
            </p>
          ) : loading || profileLoading ? (
            <p
              role="status"
              className="p-6 text-center text-slate-600"
            >
              Loading projects…
            </p>
          ) : !filteredProjects.length ? (
            <div className="rounded-2xl border border-dashed border-[#C9F5DC] p-8 text-center">
              <FaProjectDiagram className="mx-auto mb-3 text-4xl text-[#0B7A3E]" />

              <h4 className="mb-2 text-lg font-extrabold text-[#065F2F]">
                {selectedLocation
                  ? "No projects for this location yet"
                  : "Projects will appear here"}
              </h4>

              <p className="text-sm text-slate-600">
                Published council projects and activities
                will be displayed as they are added.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => {
                const images = getProjectImages(project);

                return (
                  <article
                    key={project.id}
                    className="overflow-hidden rounded-2xl border border-[#C9F5DC] bg-white shadow-sm"
                  >
                    {images.length ? (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            openPreview(project)
                          }
                          aria-label={`View pictures of ${projectTitle(
                            project
                          )}`}
                          className="block h-52 w-full overflow-hidden bg-slate-100"
                        >
                          <img
                            src={images[0]}
                            alt={projectTitle(project)}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </button>

                        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                          {images.length} picture
                          {images.length === 1 ? "" : "s"}
                        </span>

                        {images.length > 1 && (
                          <div className="grid grid-cols-3 gap-2 p-2">
                            {images
                              .slice(1)
                              .map((url, index) => (
                                <button
                                  type="button"
                                  key={url}
                                  onClick={() =>
                                    openPreview(
                                      project,
                                      index + 1
                                    )
                                  }
                                  aria-label={`View picture ${
                                    index + 2
                                  } of ${projectTitle(
                                    project
                                  )}`}
                                >
                                  <img
                                    src={url}
                                    alt=""
                                    loading="lazy"
                                    className="h-16 w-full rounded-lg object-cover"
                                  />
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-44 items-center justify-center bg-[#E9FFF3]">
                        <FaImage
                          className="text-4xl text-[#0B7A3E]"
                          aria-label="No project picture"
                        />
                      </div>
                    )}

                    <div className="p-5">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0B7A3E]">
                        {project.category ||
                          "Community Project"}
                      </p>

                      <h4 className="mb-4 text-xl font-extrabold text-[#065F2F]">
                        {projectTitle(project)}
                      </h4>

                      <div className="space-y-2 text-sm text-slate-600">
                        <p className="flex gap-2">
                          <FaMapMarkerAlt className="mt-1 shrink-0 text-[#065F2F]" />
                          <span>
                            {projectLocation(project)}
                          </span>
                        </p>

                        <p className="flex gap-2">
                          <FaCalendarAlt className="mt-1 shrink-0 text-[#065F2F]" />
                          <span>
                            {formatDate(
                              project.commissioningDate ||
                                project.startDate
                            )}
                          </span>
                        </p>

                        {project.commissionedBy && (
                          <p className="flex gap-2">
                            <FaUserTie className="mt-1 shrink-0 text-[#065F2F]" />
                            <span>
                              {project.commissionedBy}
                            </span>
                          </p>
                        )}
                      </div>

                      {project.description && (
                        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                          {project.description}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {project.projectStatus && (
                          <span className="rounded-full bg-[#E9FFF3] px-3 py-1 text-xs font-bold capitalize text-[#065F2F]">
                            {project.projectStatus}
                          </span>
                        )}

                        {canManageContent && (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                              project.status ===
                              "published"
                                ? "bg-green-50 text-green-800"
                                : "bg-yellow-50 text-yellow-800"
                            }`}
                          >
                            {project.status || "draft"}
                          </span>
                        )}
                      </div>

                      {images.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            openPreview(project)
                          }
                          className={`${BUTTON_CLASS} mt-4 text-sm`}
                        >
                          <FaImage />
                          View Pictures
                        </button>
                      )}

                      {canManageContent && (
                        <div className="mt-4 flex gap-3 border-t border-[#C9F5DC] pt-4">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              openProjectForm(project)
                            }
                            className="inline-flex items-center gap-2 text-sm font-bold text-[#065F2F] disabled:opacity-50"
                          >
                            <FaEdit />
                            Edit
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              handleDelete(project)
                            }
                            className="inline-flex items-center gap-2 text-sm font-bold text-red-600 disabled:opacity-50"
                          >
                            <FaTrash />
                            {deletingId === project.id
                              ? "Deleting…"
                              : "Delete"}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div
          id="programme"
          className="mb-16 text-center"
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-[#0B7A3E]">
            Our Focus Areas
          </p>

          <h3 className="mb-8 text-3xl font-extrabold text-[#065F2F]">
            People, Opportunity and Community
          </h3>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FOCUS_AREAS.map((area) => {
              const Icon = area.icon;

              return (
                <motion.div
                  key={area.title}
                  whileHover={
                    reduceMotion
                      ? undefined
                      : { y: -4 }
                  }
                  className="rounded-2xl border border-[#C9F5DC] bg-white p-6 shadow-sm"
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#065F2F]">
                    <Icon className="text-2xl text-[#BFE8A8]" />
                  </div>

                  <h4 className="mb-3 text-lg font-extrabold text-[#065F2F]">
                    {area.title}
                  </h4>

                  <p className="text-sm leading-relaxed text-slate-600">
                    {area.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="mb-12 grid gap-6 rounded-3xl border border-[#C9F5DC] bg-white p-6 md:grid-cols-2 md:p-10">
          <div>
            <h3 className="mb-4 text-2xl font-extrabold text-[#065F2F]">
              Our Vision
            </h3>

            <p className="whitespace-pre-line border-l-4 border-[#F2B705] pl-5 leading-relaxed text-slate-600">
              {cycProfile?.vision ||
                "A united community where young people develop their potential, live peacefully and contribute positively to society."}
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-2xl font-extrabold text-[#065F2F]">
              Our Mission
            </h3>

            <p className="whitespace-pre-line border-l-4 border-[#065F2F] pl-5 leading-relaxed text-slate-600">
              {cycProfile?.mission ||
                "To bring young people together through learning, leadership, self-reliance and service for the development of Jenta Adamu Ward."}
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-[#065F2F] px-6 py-10 text-center text-white">
          <h3 className="mb-4 text-2xl font-extrabold md:text-3xl">
            A Stronger Community Starts With Us
          </h3>

          <p className="mx-auto mb-6 max-w-2xl leading-relaxed text-white/85">
            Young people, community members and partners
            all have a part to play. Connect with the
            council to learn about its activities and ways
            to contribute.
          </p>

          <a
            href="#contact"
            onClick={(event) => {
              if (
                document.getElementById("contact")
              ) {
                event.preventDefault();
                scrollToId("contact");
              }
            }}
            className="inline-block rounded-full bg-[#F2B705] px-7 py-3 font-bold text-[#034324]"
          >
            Contact the Council
          </a>
        </div>
      </div>

      {safePreview && (
        <div
          onClick={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setImagePreview(null);
            }
          }}
          className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-black/90 px-4 py-6"
        >
          <div
            ref={previewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cyc-project-preview-title"
            className="my-auto w-full max-w-5xl rounded-2xl bg-black p-3 text-white sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3
                  id="cyc-project-preview-title"
                  className="text-lg font-extrabold md:text-2xl"
                >
                  {projectTitle(safePreview.project)}
                </h3>

                <p
                  aria-live="polite"
                  className="mt-1 text-sm text-white/70"
                >
                  {previewIndex + 1} of{" "}
                  {safePreview.images.length}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close project pictures"
                onClick={() =>
                  setImagePreview(null)
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#065F2F]"
              >
                <FaTimes />
              </button>
            </div>

            <div className="relative">
              <img
                src={
                  safePreview.images[previewIndex]
                }
                alt={`${projectTitle(
                  safePreview.project
                )}, picture ${previewIndex + 1}`}
                className="max-h-[65vh] w-full rounded-xl object-contain"
              />

              {safePreview.images.length > 1 &&
                [
                  {
                    label: "Previous picture",
                    direction: -1,
                    Icon: FaChevronLeft,
                    position: "left-2",
                  },
                  {
                    label: "Next picture",
                    direction: 1,
                    Icon: FaChevronRight,
                    position: "right-2",
                  },
                ].map(
                  ({
                    label,
                    direction,
                    Icon,
                    position,
                  }) => (
                    <button
                      key={label}
                      type="button"
                      aria-label={label}
                      onClick={() =>
                        setPreviewIndex(
                          (previous) =>
                            (previous +
                              direction +
                              safePreview.images
                                .length) %
                            safePreview.images.length
                        )
                      }
                      className={`absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#065F2F] ${position}`}
                    >
                      <Icon />
                    </button>
                  )
                )}
            </div>

            {safePreview.images.length > 1 && (
              <div className="mt-4 grid grid-cols-4 gap-3">
                {safePreview.images.map(
                  (url, index) => (
                    <button
                      type="button"
                      key={url}
                      aria-label={`Show picture ${
                        index + 1
                      }`}
                      aria-pressed={
                        index === previewIndex
                      }
                      onClick={() =>
                        setPreviewIndex(index)
                      }
                      className={`overflow-hidden rounded-lg border-2 ${
                        index === previewIndex
                          ? "border-[#F2B705]"
                          : "border-white/20"
                      }`}
                    >
                      <img
                        src={url}
                        alt=""
                        className="h-16 w-full object-cover sm:h-20"
                      />
                    </button>
                  )
                )}
              </div>
            )}

            {safePreview.project.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/80">
                {safePreview.project.description}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default AboutUs;