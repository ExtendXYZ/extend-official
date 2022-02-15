use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

use crate::state::{
    Move, PlayerParams, Side, Space,
};

/*
 * RULES OF THE GAME
 * - Lifecycle
 *      - A board is initialized through an InitBoard ix on an account with sufficient space.
 *      - A game can be started by the board creator through a StartGame ix.
 *      - An initialized board starts in the "Inactive" state and cycles through three states:
 *          - Registering
 *          - Active
 *          - Inactive
 *      - An inactive game can be (re-) initialized by StartGame, setting it to Registering state.
 * - Registering
 *      - Any Space owner can be assigned a side for the currently registering game with a Register ix.
 *      - Spaces cannot be assigned to a side with a registered Pubkey.
 * - Voting
 *      - The first Vote ix past the registration deadline shifts the game to Active.
 *      - Move votes must be made within move_interval seconds after the previous deadline.
 *      - Spaces assigned to the side to play can vote for any legal move.
 *      - A running tally of votes is maintained.
 *      - A vote for Move::resign() counts as a vote for resignation.
 *      - The game updates when:
 *          - PK player has voted
 *          - Move_deadline has passed and another Vote ix is received
 *      - An update works as follows:
 *          - If any votes have been cast, the most popular move is applied (first to submit breaks ties)
 *          - Votes are reset
 *          - Termination conditions are checked
 *      - The game ends when any of the following occur:
 *          - Checkmate
 *			- Stalemate
 *			- The winning move is Move::resign()
 *          - Deadline elapses with no valid moves
 * - Inactive
 *      - An inactive board preserves the final game state along with a result.
 *		- A new game, replacing the old one, can be initialized with a StartGame ix.
 *      - Assigned spaces and votes are reset when the game is re-initialized.
 */

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitBoardArgs {
    pub nx: i64,
    pub ny: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct StartGameArgs {
    pub nx: i64,
    pub ny: i64,
    pub player_white: PlayerParams,
    pub player_black: PlayerParams,
    pub register_deadline: u64,  // timestamp
    pub move_interval: u16,      // seconds
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
    pub ply: u16,  // -1 to update but not actually cast vote
    pub vote: Move,
}

pub enum ChessInstruction {
    /*
     * 0. Board owner
     * 1. Board account
     * 2. System program
     */
    InitBoard,
    /*
     * 0. Board owner
     * 1. Board account
     */
    StartGame,
    /*
     * 0. Base account
     * 1. Space owner
     * 2. Space account
     * 3. Space ATA
     * 4. Board account
     */
    Register,
    /*
     * 0. Base account
     * 1. Space owner
     * 2. Space account
     * 3. Space ATA
     * 4. Board account
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
