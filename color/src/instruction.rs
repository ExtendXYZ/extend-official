use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitFrameArgs {
    pub neighborhood_x: i64,
    pub neighborhood_y: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct ChangeColorArgs {
    pub space_x: i64,
    pub space_y: i64,
    pub frame: u64,
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct ChangeColorBriefArgs {
    pub space_x: i16,
    pub space_y: i16,
    pub frame: u8,
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct MakeEditableArgs {
    pub space_x: i64,
    pub space_y: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct MakeEditableBriefArgs {
    pub space_x: i16,
    pub space_y: i16,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct TmpChangeEditableTimestampArgs {
    pub space_x: i64,
    pub space_y: i64,
    pub frame: u64,
}

pub enum ColorInstruction {


    /*
    Init metadata account (PDA) for a given mint (PDA corresponding to (x,y))
    Accounts expected:
    0. Base account
    1. account of the color frame cluster
    2. [Signer] fee payer
    3. The system program
    
    time cluster account
    */
    InitFrame,

    /*
    Change color at stage i. If space metadata is empty, any one can change the color.
    Accounts expected:
    0. Base account
    1. [Writable] Color cluster account
    2. frame base
    3. frame pointer
    4. neighborhood metadata
    5. [Writable] neighborhood creator
    6. space metadata
    7. [Writable] Owner
    8. Space Ata of owner
    9. time cluster account
    10. [Writable, signer] fee payer
    11. system program

    */
    ChangeColor,
    ChangeColorBrief,

    /*
    Makes owned space color-editable
    Accounts expected:
    0. Base account
    1. space metadata
    2. [Signer] owner
    3. space_ata
    4. [Writable] time cluster account
    */
    MakeEditable,
    MakeEditableBrief,

    /*
    Tmp instruction to change editable timestamps
    0. Base account
    1. frame
    2. neighborhood frame base
    3. neighborhood frame pointer
    4. [Writable] time cluster account
    5. [Signer] feepayer 
    */
    TmpChangeEditableTimestamp,
}

impl ColorInstruction {
    pub fn unpack(tag: &u8) -> Result<Self, ProgramError> {
        Ok(match tag {
            0 => Self::InitFrame,
            1 => Self::ChangeColor,
            2 => Self::ChangeColorBrief,
            3 => Self::MakeEditable,
            4 => Self::MakeEditableBrief,
            5 => Self::TmpChangeEditableTimestamp,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
