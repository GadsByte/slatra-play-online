export type PlayerId = string;
export type RoomId = string;
export type RoomCode = string;
export type MatchId = string;

export type RoomStatus = 'waiting' | 'in_game';
export type RoomVisibility = 'public' | 'private';
export type MatchStatus = 'active';
export type FactionDto = 'plague' | 'bone';
export type UnitClassDto = 'grunt' | 'medic' | 'heavy' | 'captain';
export type DirectionDto = 'north' | 'south' | 'east' | 'west';
export type GamePhaseDto =
  | 'title'
  | 'hazard_placement'
  | 'objective_roll'
  | 'deployment_p1'
  | 'deployment_p2'
  | 'initiative_roll'
  | 'playing'
  | 'game_over';
export type PlayingSubPhaseDto = 'select_unit' | 'unit_actions' | 'confirm_end';

export interface PositionDto {
  row: number;
  col: number;
}

export interface UnitDto {
  id: string;
  faction: FactionDto;
  unitClass: UnitClassDto;
  name: string;
  position: PositionDto;
  hp: number;
  maxHp: number;
  move: number;
  attackDice: string;
  facing: DirectionDto;
  activated: boolean;
  pinned: boolean;
  usedOncePerGame: boolean;
  usedAbilityThisRound: boolean;
  usedReactionThisRound: boolean;
}

export interface CorpseMarkerDto {
  position: PositionDto;
  faction: FactionDto;
  unitClass: UnitClassDto;
  unitId: string;
  cleansed: boolean;
}

export interface HazardTileDto {
  position: PositionDto;
}

export interface ObjectiveTokenDto {
  position: PositionDto;
  faction: FactionDto;
  type: 'plague_crate' | 'bone_altar';
  used: boolean;
}

export interface DiceResultDto {
  dice: string;
  rolls: number[];
  total: number;
  label: string;
}

export interface ActiveUnitStateDto {
  unitId: string;
  movementRemaining: number;
  hasAttacked: boolean;
  hasUsedAbility: boolean;
  hasInteractedObjective: boolean;
}

export interface MatchGameStateDto {
  phase: GamePhaseDto;
  subPhase: PlayingSubPhaseDto;
  round: number;
  currentPlayer: FactionDto;
  initiativePlayer: FactionDto;
  units: UnitDto[];
  corpses: CorpseMarkerDto[];
  hazards: HazardTileDto[];
  objectives: ObjectiveTokenDto[];
  activeUnit: ActiveUnitStateDto | null;
  selectedTile: PositionDto | null;
  diceResult: DiceResultDto | null;
  log: string[];
  winner: FactionDto | null;
  hazardsToPlace: number;
  selectedDeployClass: UnitClassDto | null;
  bannerActive: boolean;
  auraActive: boolean;
  damageBuff: { faction: FactionDto; extraDice: string } | null;
  lastRiteUsed: boolean;
  returnOfDeadUsed: boolean;
}

export function createInitialMatchGameState(): MatchGameStateDto {
  return {
    phase: 'hazard_placement',
    subPhase: 'select_unit',
    round: 0,
    currentPlayer: 'plague',
    initiativePlayer: 'plague',
    units: [],
    corpses: [],
    hazards: [],
    objectives: [],
    activeUnit: null,
    selectedTile: null,
    diceResult: null,
    log: [],
    winner: null,
    hazardsToPlace: 4,
    selectedDeployClass: null,
    bannerActive: false,
    auraActive: false,
    damageBuff: null,
    lastRiteUsed: false,
    returnOfDeadUsed: false,
  };
}

export interface PlayerIdentityDto {
  id: PlayerId;
  displayName: string;
}

export interface LobbyRoomSummaryDto {
  id: RoomId;
  name: string;
  code: RoomCode;
  hostPlayerId: PlayerId;
  hostDisplayName: string;
  playerCount: number;
  maxPlayers: number;
  status: RoomStatus;
  visibility: RoomVisibility;
  activeMatchId: MatchId | null;
}

export interface RoomPlayerDto {
  id: PlayerId;
  displayName: string;
  ready: boolean;
}

export interface RoomDetailsDto {
  id: RoomId;
  name: string;
  code: RoomCode;
  hostPlayerId: PlayerId;
  maxPlayers: number;
  status: RoomStatus;
  visibility: RoomVisibility;
  activeMatchId: MatchId | null;
  players: RoomPlayerDto[];
}

export interface MatchSnapshotDto {
  id: MatchId;
  roomId: RoomId;
  status: MatchStatus;
  gameState: MatchGameStateDto;
  createdAt: string;
}

export interface RegisterPlayerRequestDto {
  displayName: string;
}

export interface CreateRoomRequestDto {
  name: string;
  visibility: RoomVisibility;
}

export interface JoinRoomRequestDto {
  roomIdOrCode: string;
}

export interface LeaveRoomRequestDto {
  roomId: RoomId;
}

export interface SetReadyRequestDto {
  roomId: RoomId;
  ready: boolean;
}

export interface StartMatchRequestDto {
  roomId: RoomId;
}

export interface SessionReadyPayload {
  player: PlayerIdentityDto;
}

export interface LobbyRoomsPayload {
  rooms: LobbyRoomSummaryDto[];
}

export interface RoomStatePayload {
  room: RoomDetailsDto;
}

export interface MatchStatePayload {
  match: MatchSnapshotDto;
}

export interface RoomNotFoundPayload {
  roomIdOrCode: string;
}

export interface RoomErrorPayload {
  message: string;
}

export interface MatchErrorPayload {
  message: string;
  roomId?: RoomId;
}

export interface ClientToServerEvents {
  'session:set-name': (payload: RegisterPlayerRequestDto) => void;
  'lobby:list-rooms': () => void;
  'room:create': (payload: CreateRoomRequestDto) => void;
  'room:join': (payload: JoinRoomRequestDto) => void;
  'room:leave': (payload: LeaveRoomRequestDto) => void;
  'room:set-ready': (payload: SetReadyRequestDto) => void;
  'room:start-match': (payload: StartMatchRequestDto) => void;
}

export interface ServerToClientEvents {
  'session:ready': (payload: SessionReadyPayload) => void;
  'lobby:rooms': (payload: LobbyRoomsPayload) => void;
  'room:state': (payload: RoomStatePayload) => void;
  'match:state': (payload: MatchStatePayload) => void;
  'room:not-found': (payload: RoomNotFoundPayload) => void;
  'room:error': (payload: RoomErrorPayload) => void;
  'match:error': (payload: MatchErrorPayload) => void;
}
