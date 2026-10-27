// Public API of the collections module (CODE_QUALITY §3.2): saves and collections, by post id.
// Post cards for these lists come from the `library` module.
export {
  addToCollection,
  createCollection,
  deleteCollection,
  getCollectionIdsForPost,
  getCollectionPage,
  getRecentlySavedSkillIds,
  getSavedPostIds,
  listMyCollections,
  listSavedPostIds,
  removeFromCollection,
  savePost,
  unsavePost,
  updateCollection,
  type CollectionRow,
} from "./service";
