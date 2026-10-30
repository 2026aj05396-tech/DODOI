// Public API of the follows module (CODE_QUALITY §3.2): who follows whom (P2-06).
export {
  FOLLOW_RATE_LIMIT,
  followUser,
  getFollowedUserIds,
  getFollowersAmong,
  getFollowerUserIds,
  getFollowState,
  getOwnFollowCounts,
  listOwnFollowers,
  listOwnFollowing,
  removeFollowsBetween,
  unfollowUser,
} from "./service";
