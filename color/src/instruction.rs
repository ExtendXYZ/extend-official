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
    Change color at stage i
    Accounts expected:
    0. Base account
    1. [Writable] Color cluster account
    2. space metadata
    2. neighborhood metadata
    3. [Writable] Owner
    4. Ata of owner
    time cluster account
    [Writable, signer] fee payer
    system program

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
}

impl ColorInstruction {
    pub fn unpack(tag: &u8) -> Result<Self, ProgramError> {
        Ok(match tag {
            0 => Self::InitFrame,
            1 => Self::ChangeColor,
            2 => Self::ChangeColorBrief,
            // 3 => Self::MakeEditable,
            // 4 => Self::MakeEditableBrief,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
