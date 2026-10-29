// Public API of the journal module (CODE_QUALITY §3.2): projects and progress entries (P2-03).
export {
  addEntry,
  checkMaterial,
  createProject,
  deleteEntry,
  deleteProject,
  getProject,
  isOwnProject,
  listMyProjects,
  listProfileProjects,
  startProjectFromPost,
  updateEntry,
  updateProject,
} from "./service";
