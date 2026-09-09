// Re-export the game's own wire types so the plugin can never drift from the server.
// This is a source dependency on purpose: if the protocol changes, this package fails to
// compile rather than failing silently against a live village.
export type {
  ClientMsg, ServerMsg, PrivateState, PublicLot, PublicPlot, SnapPlayer, Wild, Dir,
} from '../../../shared/protocol';
