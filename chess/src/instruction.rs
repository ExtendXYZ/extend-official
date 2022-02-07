use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

use crate::state::{
    Move, PlayerParams, Side,
};

/*
 * RULES OF THE GAME
 * - Lifecycle
 *      - A board is initialized through an InitBoard ix.
 *      - A game can be started by running StartGame. Only the board creator can do this.
 *      - The account is a PDA derived with the neighborhood location and creator pubkey (PK).
 *      - Any number of boards can be created but we will only show the one with our hot wallet.
 *      - An initialized board starts in the "Inactive" state and cycles through three states:
 *          - Registering
 *          - Active
 *          - Inactive
 *      - An inactive game can be re-initialized by StartGame, returning it to Registering state.
 * - Registering
 *      - Any holder can choose a side with a Register ix. Those Spaces are then "assigned".
 *      - Assigned Spaces cannot re-register.
 *      - The first Register at least interval_register seconds after the InitGame:
 *          - If both sides have a PK or quorum_register, shifts the game to Active.
 *          - If not, extends the registration interval.
 * - Active
 *      - Move votes must be made within interval_move seconds.
 *      - All assigned Spaces can vote for a specific move, which is recorded.
 *      - Moves cannot be re-voted.
 *      - A vote for Move::none() counts as a vote for resignation.
 *      - If any of the following conditions trigger after a vote, the game updates:
 *          - PK player has voted for a move
 *          - Majority of assigned Spaces, and at least quorum_move spaces, have voted for the same move
 *          - At least interval_move seconds have passed since the last update
 *      - An update works as follows:
 *          - If there is a valid move (PK or quorum), the move is made and the board state is updated
 *          - Votes are reset
 *          - Termination conditions are checked
 *      - If any of the following conditions trigger after an update, the game becomes Finished.
 *          - Checkmate
 *          - Threefold
 *          - 50-move rule
 *          - No valid move on an update (no quorum/PK or winning move is Move::none())
 * - Inactive
 *      - An inactive game cannot be re-initialized for at least interval_keep seconds.
 *      - When a board is first created, interval_keep is 0.
 *      - After interval_keep, the game can be re-initialized by a StartGame ix.
 *      - Assigned spaces are reset when the game is re-initialized.
 */

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Neighborhood {
    pub x: i64,
    pub y: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitBoardArgs {
    pub neighborhood: Neighborhood,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct StartGameArgs {
    pub neighborhood: Neighborhood,
    pub player_white: PlayerParams,
    pub player_black: PlayerParams,
    pub interval_register: u64,  // seconds, will convert to blocks
    pub interval_move: u64,      // seconds, will convert to blocks
    pub interval_keep: u64,      // seconds, will convert to blocks
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct Space {
    pub x: i64,
    pub y: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct RegisterArgs {
    pub space: Space,
    pub side: Side,
}

// Resign is Move::none()
#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct VoteArgs {
    pub space: Space,
    pub ply: u16,
    pub vote: Move,
}

pub enum ChessInstruction {
    /*
     * 0. Base account
     * 1. Board owner
     * 2. Board account
     * 3. System program
     */
    InitBoard,
    /*
     * 0. Base account
     * 1. Board owner
     * 2. Board account
     */
    StartGame,
    /*
     * 0. Base account
     * 1. Space owner
     * 2. Space account
     * 3. Board account
     */
    Register,
    /*
     * 0. Base account
     * 1. Space owner
     * 2. Space account
     * 3. Board account
     */
    Vote,
}

impl ChessInstruction {
    pub fn unpack(tag: &u8) -> Result<Self, ProgramError> {
        Ok(match tag {
            0 => Self::InitBoard,
            1 => Self::StartGame,
            2 => Self::Register,
            3 => Self::Vote,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
