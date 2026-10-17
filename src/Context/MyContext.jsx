import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, getDoc, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "firebase/auth";
import { db } from "../firebase";
const MyContext = createContext(undefined);
export const CYC_COLLECTION = "cyc";
export const CYC_ID = "jenta-adamu-ward";
const DEFAULT_PROFILE = {
  id: CYC_ID,
  title: "Central Youth Council",
  shortName: "CYC Jenta Adamu Ward",
  slogan: "Build the Youth, Build the Nation",
  location: "Jenta Adamu Ward, Jos North, Plateau State, Nigeria",
  description: "A community youth council supporting youth development and community participation in Jenta Adamu Ward.",
  logoUrl: "/images/cyclogo.png"
};
const CONTENT_COLLECTIONS = {
  documentaries: "documentary",
  archives: "archives",
  news: "news",
  projects: "projects",
  executives: "executives",
  gallery: "gallery",
  videos: "videos",
  photos: "photos",
  records: "records",
  platforms: "platforms",
  comments: "comments"
};
const CONTRIBUTION_COLLECTIONS = new Set(["executives", "gallery"]);
const emptyContent = () => Object.fromEntries(Object.keys(CONTENT_COLLECTIONS).map(key => [key, []]));
const emptyPrivateData = () => ({
  users: [],
  inboxMessages: [],
  messages: []
});
const subCollectionRef = name => collection(db, CYC_COLLECTION, CYC_ID, name);
const subDocumentRef = (name, id) => {
  if (typeof id !== "string" || !id.trim() || id.includes("/")) {
    throw new Error("A valid document ID is required.");
  }
  return doc(db, CYC_COLLECTION, CYC_ID, name, id);
};
const timestampMillis = value => {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return Date.parse(value) || 0;
  return 0;
};
const snapshotItems = snapshot => snapshot.docs.map(item => ({
  ...item.data(),
  id: item.id,
  firestorePath: item.ref.path
})).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
const publishedItems = items => items.filter(item => item.status === "published");
const mediaFields = (data = {}, defaults = {}) => ({
  title: data.title || "",
  description: data.description || "",
  category: data.category || defaults.category || "general",
  mediaType: data.mediaType || defaults.mediaType || "video",
  mediaUrl: data.mediaUrl || "",
  thumbnailUrl: data.thumbnailUrl || "",
  source: data.source || "Cloudinary",
  status: data.status || "published",
  fileName: data.fileName || "",
  fileType: data.fileType || "",
  fileSize: data.fileSize || 0,
  storageProvider: data.storageProvider || "cloudinary"
});
const newsFields = (data = {}) => ({
  title: data.title || "",
  description: data.description || "",
  category: data.category || "General",
  imageUrl: data.imageUrl || "",
  status: data.status || "published",
  fileName: data.fileName || "",
  fileType: data.fileType || "",
  fileSize: data.fileSize || 0,
  storageProvider: data.storageProvider || "cloudinary"
});
const projectFields = (data = {}) => ({
  title: data.title || "",
  description: data.description || "",
  category: data.category || "Community Development",
  imageUrl: data.imageUrl || "",
  location: data.location || "",
  startDate: data.startDate || "",
  endDate: data.endDate || "",
  projectStatus: data.projectStatus || "planned",
  status: data.status || "published"
});
const executiveFields = (data = {}) => ({
  name: data.name || "",
  position: data.position || "",
  bio: data.bio || "",
  photoUrl: data.photoUrl || "",
  photoPublicId: data.photoPublicId || "",
  videoUrl: data.videoUrl || "",
  videoPublicId: data.videoPublicId || "",
  tenure: data.tenure || "",
  displayOrder: Number.isFinite(Number(data.displayOrder)) ? Number(data.displayOrder) : 0,
  status: data.status || "published"
});
export const useMyContext = () => {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error("useMyContext must be used inside MyContextProvider");
  }
  return context;
};
export const MyContextProvider = ({
  children
}) => {
  const auth = useMemo(() => getAuth(db.app), []);
  const cycDocRef = useMemo(() => doc(db, CYC_COLLECTION, CYC_ID), []);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [cycProfile, setCycProfile] = useState(DEFAULT_PROFILE);
  const [content, setContent] = useState(emptyContent);
  const [privateData, setPrivateData] = useState(emptyPrivateData);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [listenerErrors, setListenerErrors] = useState({});
  const [selectedDocumentaryCategory, setSelectedDocumentaryCategory] = useState("watch-documentary");
  const [selectedArchiveCategory, setSelectedArchiveCategory] = useState("records");
  const signedInUserData = currentUser && userProfile?.uid === currentUser.uid ? userProfile : null;
  const isAdmin = Boolean(signedInUserData?.role === "admin" && signedInUserData?.status === "active");
  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setUserProfile(null);
      setPrivateData(emptyPrivateData());
      setProfileLoading(Boolean(user));
      setCurrentUser(user);
      setLoading(false);
    }, error => {
      console.error("CYC authentication listener:", error);
      setCurrentUser(null);
      setUserProfile(null);
      setPrivateData(emptyPrivateData());
      setProfileLoading(false);
      setLoading(false);
    });
  }, [auth]);
  useEffect(() => {
    if (!currentUser?.uid) {
      setUserProfile(null);
      setProfileLoading(false);
      return undefined;
    }
    setUserProfile(null);
    setProfileLoading(true);
    return onSnapshot(subDocumentRef("users", currentUser.uid), snapshot => {
      setUserProfile(snapshot.exists() ? {
        ...snapshot.data(),
        id: snapshot.id,
        uid: snapshot.id
      } : null);
      setProfileLoading(false);
      setListenerErrors(previous => ({
        ...previous,
        userProfile: null
      }));
    }, error => {
      console.error("CYC member profile listener:", error);
      setUserProfile(null);
      setProfileLoading(false);
      setListenerErrors(previous => ({
        ...previous,
        userProfile: "We couldn't load your council account details."
      }));
    });
  }, [currentUser?.uid]);
  useEffect(() => {
    return onSnapshot(cycDocRef, snapshot => {
      setCycProfile(snapshot.exists() ? {
        ...DEFAULT_PROFILE,
        ...snapshot.data(),
        id: snapshot.id
      } : DEFAULT_PROFILE);
      setListenerErrors(previous => ({
        ...previous,
        councilProfile: null
      }));
    }, error => {
      console.error("CYC council profile listener:", error);
      setCycProfile(DEFAULT_PROFILE);
      setListenerErrors(previous => ({
        ...previous,
        councilProfile: "We couldn't load the council information."
      }));
    });
  }, [cycDocRef, currentUser?.uid]);
  useEffect(() => {
    // Visitors see published content. Contributors also see their own drafts.
    // Administrators retain full access to all content and drafts.
    let active = true;
    setContent(emptyContent());
    const unsubscribers = [];
    Object.entries(CONTENT_COLLECTIONS).forEach(([key, name]) => {
      const reference = subCollectionRef(name);
      const sources = isAdmin ? [reference] : [query(reference, where("status", "==", "published"))];
      if (!isAdmin && currentUser?.uid && CONTRIBUTION_COLLECTIONS.has(name)) {
        sources.push(query(reference, where("createdBy", "==", currentUser.uid)));
      }
      const snapshots = new Map();
      const errors = new Map();
      const publish = () => {
        if (!active) return;
        const merged = new Map();
        snapshots.forEach(items => items.forEach(item => merged.set(item.id, item)));
        const items = Array.from(merged.values()).sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
        setContent(previous => ({
          ...previous,
          [key]: items
        }));
        setListenerErrors(previous => ({
          ...previous,
          [key]: Array.from(errors.values()).find(Boolean) || null
        }));
      };
      sources.forEach((source, index) => {
        unsubscribers.push(onSnapshot(source, snapshot => {
          if (!active) return;
          snapshots.set(index, snapshotItems(snapshot));
          errors.delete(index);
          publish();
        }, error => {
          if (!active) return;
          console.error(`CYC ${name} listener:`, error);
          snapshots.set(index, []);
          errors.set(index, "We couldn't load this content. Please try again later.");
          publish();
        }));
      });
    });
    return () => {
      active = false;
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [isAdmin, currentUser?.uid]);
  useEffect(() => {
    setPrivateData(emptyPrivateData());
    if (!isAdmin) return undefined;
    const collections = {
      users: "users",
      inboxMessages: "inbox",
      messages: "messages"
    };
    const unsubscribers = Object.entries(collections).map(([key, name]) => onSnapshot(subCollectionRef(name), snapshot => {
      setPrivateData(previous => ({
        ...previous,
        [key]: snapshotItems(snapshot)
      }));
      setListenerErrors(previous => ({
        ...previous,
        [key]: null
      }));
    }, error => {
      console.error(`CYC private ${name} listener:`, error);
      setPrivateData(previous => ({
        ...previous,
        [key]: []
      }));
      setListenerErrors(previous => ({
        ...previous,
        [key]: "We couldn't load these administration records."
      }));
    }));
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [isAdmin, currentUser?.uid]);

  // Gate returned data immediately when permissions change, before effects run.
  const visibleContent = Object.fromEntries(Object.entries(content).map(([key, items]) => [key, items.filter(item => isAdmin || item.status === "published" || CONTRIBUTION_COLLECTIONS.has(CONTENT_COLLECTIONS[key]) && currentUser?.uid && item.createdBy === currentUser.uid)]));
  const users = isAdmin ? privateData.users : [];
  const inboxMessages = isAdmin ? privateData.inboxMessages : [];
  const messages = isAdmin ? privateData.messages : [];
  const publishedDocumentaries = publishedItems(visibleContent.documentaries);
  const publishedArchives = publishedItems(visibleContent.archives);
  const publishedNews = publishedItems(visibleContent.news);
  const publishedProjects = publishedItems(visibleContent.projects);
  const publishedExecutives = publishedItems(visibleContent.executives).sort((a, b) => (Number(a.displayOrder) || 0) - (Number(b.displayOrder) || 0));
  const publishedGallery = publishedItems(visibleContent.gallery);
  const unreadInboxMessages = inboxMessages.filter(item => item.status === "unread");
  const documentaryByCategory = {
    watchDocumentary: publishedDocumentaries.filter(item => (item.category || "watch-documentary") === "watch-documentary"),
    trailers: publishedDocumentaries.filter(item => item.category === "trailers"),
    behindScenes: publishedDocumentaries.filter(item => item.category === "behind-scenes"),
    photoHighlights: publishedDocumentaries.filter(item => item.category === "photo-highlights"),
    broadcast: publishedDocumentaries.filter(item => item.category === "broadcast")
  };
  const archiveByCategory = {
    records: publishedArchives.filter(item => (item.category || "records") === "records"),
    videos: publishedArchives.filter(item => item.category === "videos"),
    leadershipHub: publishedArchives.filter(item => item.category === "leadership-hub"),
    platforms: publishedArchives.filter(item => item.category === "platforms")
  };
  const requireSignedIn = () => {
    if (!currentUser?.uid || auth.currentUser?.uid !== currentUser.uid) {
      throw new Error("Please sign in to continue.");
    }
  };
  const requireAdmin = () => {
    requireSignedIn();
    if (!isAdmin) {
      throw new Error("Only council administrators can make this change.");
    }
  };
  const canEditContribution = item => Boolean(currentUser?.uid && item && (isAdmin || item.createdBy === currentUser.uid));
  const requireContentAccess = async (name, id) => {
    if (!CONTRIBUTION_COLLECTIONS.has(name)) {
      requireAdmin();
      return;
    }
    requireSignedIn();
    const snapshot = await getDoc(subDocumentRef(name, id));
    requireSignedIn();
    if (!snapshot.exists()) throw new Error("This entry is no longer available.");
    if (!canEditContribution(snapshot.data())) {
      throw new Error("You can only change entries you added.");
    }
  };
  const actorFields = prefix => ({
    [prefix]: currentUser.uid,
    [`${prefix}Email`]: currentUser.email || "",
    [`${prefix}Name`]: currentUser.displayName || signedInUserData?.name || currentUser.email?.split("@")[0] || ""
  });
  const createContent = async (name, fields) => {
    if (CONTRIBUTION_COLLECTIONS.has(name)) requireSignedIn();else requireAdmin();
    return addDoc(subCollectionRef(name), {
      ...fields,
      ...actorFields("createdBy"),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  };
  const editContent = async (name, id, fields) => {
    await requireContentAccess(name, id);
    await updateDoc(subDocumentRef(name, id), {
      ...fields,
      ...actorFields("updatedBy"),
      updatedAt: serverTimestamp()
    });
  };
  const removeContent = async (name, id) => {
    await requireContentAccess(name, id);
    await deleteDoc(subDocumentRef(name, id));
  };
  const signUpCycUser = async ({
    name,
    email,
    password,
    phone = ""
  }) => {
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim() : "";
    if (!cleanName || !cleanEmail) {
      throw new Error("Please enter your name and email address.");
    }
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    await setDoc(subDocumentRef("users", credential.user.uid), {
      uid: credential.user.uid,
      name: cleanName,
      email: credential.user.email || cleanEmail,
      phone: typeof phone === "string" ? phone.trim() : "",
      role: "viewer",
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await updateProfile(credential.user, {
      displayName: cleanName
    });
    return credential.user;
  };
  const signInCycUser = async ({
    email,
    password
  }) => {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
    return credential.user;
  };
  const logoutCycUser = async () => {
    await signOut(auth);
  };
  const updateCycProfile = async (data = {}) => {
    requireAdmin();
    const allowedFields = ["title", "shortName", "slogan", "location", "description", "mission", "vision", "history", "email", "phone", "whatsapp", "address", "facebookUrl", "logoUrl", "website"];
    const fields = Object.fromEntries(allowedFields.filter(key => data[key] !== undefined).map(key => [key, data[key]]));
    await setDoc(cycDocRef, {
      ...fields,
      ...actorFields("updatedBy"),
      updatedAt: serverTimestamp()
    }, {
      merge: true
    });
  };
  const markInboxMessageAsRead = id => editContent("inbox", id, {
    status: "read"
  });
  const deleteInboxMessage = id => removeContent("inbox", id);
  const addDocumentary = data => createContent("documentary", mediaFields(data, {
    category: "watch-documentary"
  }));
  const updateDocumentary = (id, data) => editContent("documentary", id, mediaFields(data, {
    category: "watch-documentary"
  }));
  const deleteDocumentary = id => removeContent("documentary", id);
  const addArchive = data => createContent("archives", mediaFields(data, {
    category: "records"
  }));
  const updateArchive = (id, data) => editContent("archives", id, mediaFields(data, {
    category: "records"
  }));
  const deleteArchive = id => removeContent("archives", id);
  const addNews = data => createContent("news", newsFields(data));
  const updateNews = (id, data) => editContent("news", id, newsFields(data));
  const deleteNews = id => removeContent("news", id);
  const addProject = data => createContent("projects", projectFields(data));
  const updateProject = (id, data) => editContent("projects", id, projectFields(data));
  const deleteProject = id => removeContent("projects", id);
  const addExecutive = data => createContent("executives", executiveFields(data));
  const updateExecutive = (id, data) => editContent("executives", id, executiveFields(data));
  const deleteExecutive = id => removeContent("executives", id);
  const addGalleryItem = data => createContent("gallery", mediaFields(data, {
    category: "activities",
    mediaType: "image"
  }));
  const updateGalleryItem = (id, data) => editContent("gallery", id, mediaFields(data, {
    category: "activities",
    mediaType: "image"
  }));
  const deleteGalleryItem = id => removeContent("gallery", id);
  const searchByKeyword = (items, keyword) => {
    if (!Array.isArray(items) || typeof keyword !== "string") return [];
    const search = keyword.trim().toLowerCase();
    if (!search) return items;
    const containsKeyword = (value, seen = new WeakSet()) => {
      if (typeof value === "string") return value.toLowerCase().includes(search);
      if (!value || typeof value !== "object" || seen.has(value)) return false;
      seen.add(value);
      return Object.values(value).some(entry => containsKeyword(entry, seen));
    };
    return items.filter(item => containsKeyword(item));
  };
  const capitalizeWords = text => typeof text === "string" ? text.replace(/\b\w/g, char => char.toUpperCase()) : "";
  const value = {
    loading,
    profileLoading,
    listenerErrors,
    currentUser,
    signedInUserData,
    isAdmin,
    canManageContent: isAdmin,
    canContribute: Boolean(currentUser?.uid),
    canEditContribution,
    cycProfile,
    updateCycProfile,
    firestoreRoot: `${CYC_COLLECTION}/${CYC_ID}`,
    ...visibleContent,
    users,
    inboxMessages,
    unreadInboxMessages,
    messages,
    publishedDocumentaries,
    documentaryByCategory,
    publishedArchives,
    archiveByCategory,
    publishedNews,
    publishedProjects,
    publishedExecutives,
    publishedGallery,
    selectedDocumentaryCategory,
    setSelectedDocumentaryCategory,
    selectedArchiveCategory,
    setSelectedArchiveCategory,
    signUpCycUser,
    signInCycUser,
    logoutCycUser,
    // Compatibility aliases: all use the CYC paths above.
    newDawnProfile: cycProfile,
    signUpNewDawnUser: signUpCycUser,
    signInNewDawnUser: signInCycUser,
    logoutNewDawnUser: logoutCycUser,
    markInboxMessageAsRead,
    deleteInboxMessage,
    addDocumentary,
    updateDocumentary,
    deleteDocumentary,
    addArchive,
    updateArchive,
    deleteArchive,
    addNews,
    updateNews,
    deleteNews,
    addProject,
    updateProject,
    deleteProject,
    addExecutive,
    updateExecutive,
    deleteExecutive,
    addGalleryItem,
    updateGalleryItem,
    deleteGalleryItem,
    searchByKeyword,
    capitalizeWords
  };
  return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
};
export default MyContextProvider;
