use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct SetRentArgs{
    pub space_x: i64,
    pub space_y: i64,
    pub price: u64,
    pub min_duration: u64,
    pub max_duration: u64,
    pub max_timestamp: u64,
    pub create: bool,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct AcceptRentArgs {
    pub space_x: i64,
    pub space_y: i64,
    pub price: u64,
    pub rent_time: u64,
}

pub enum RentInstruction {

    /*
    Accounts expected:
    0. base
    1. space metadata
    2. [Writable] rent account
    3. [Signer] lessor wallet
    4. ATA of lessor holding space
    5. system program
    */
    SetRent,

    /*
    Accounts expected:
    0. base
    1. space metadata
    2. [Writable] rent vault account
    3. [Signer, Writable] lessee wallet
    4. [Writable] lessor wallet
    5. ATA of lessor holding space
    6. system program
    */
    AcceptRent,
}

impl RentInstruction {
    pub fn unpack(tag: &u8) -> Result<Self, ProgramError> {
        Ok(match tag {
            0 => Self::SetRent,
            1 => Self::AcceptRent,
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
