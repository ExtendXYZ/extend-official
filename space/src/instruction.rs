use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::program_error::ProgramError;

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitBaseArgs{

}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitNeighborhoodMetadataArgs {
    pub neighborhood_x: i64,
    pub neighborhood_y: i64,
    pub price: u64,
    pub neighborhood_name: [u8; 64],
    pub voucher_live_date: u64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitSpaceMetadataArgs {
    pub space_x: i64,
    pub space_y: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct ChangeOfferArgs {
    pub space_x: i64,
    pub space_y: i64,
    pub price: u64,
    pub create: bool,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct AcceptOfferArgs {
    pub space_x: i64,
    pub space_y: i64,
    pub price: u64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct InitVoucherSystemArgs {
    pub neighborhood_x: i64,
    pub neighborhood_y: i64,
}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct RevokeAuthorityPrivilegesArgs {

}

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct UpdateAuthorityArgs {

}

#[repr(C)] // elim
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)] // elim
pub struct ChangeNeighborhoodNameArgs { // elim
    pub neighborhood_x: i64, // elim
    pub neighborhood_y: i64, // elim
    pub neighborhood_name: [u8; 64], // elim
} // elim

#[repr(C)]
#[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)]
pub struct GetVouchersArgs {
    pub neighborhood_x: i64,
    pub neighborhood_y: i64,
    pub count: u64,
    pub fee: u64,
}

// #[repr(C)] // elim
// #[derive(BorshSerialize, BorshDeserialize, PartialEq, Debug, Clone)] // elim
// pub struct TempAddxyArgs { // elim
//     pub space_x: i64, // elim
//     pub space_y: i64, // elim
// } // elim

pub enum SpaceInstruction {

    /*
    Accounts expected:
    0. [Writable, Signer] Base
    1. [Writable] Neighborhood list
    2. [Signer] payer
    3. system program
    */
    InitBase,

    /*
    Accounts expected:
    0. [Writable] Base account
    1. [Writable] neighborhood metadata account
    2. [Writable] neighborhood list
    3. candymachine_config
    4. candymachine_account
    5. [Signer] creator
    6. creator ATA for payment token
    7. payment token mint
    8. [Writable, signer] voucher_mint
    9. system program
    10. token program
    11. rent program

    */
    InitNeighborhoodMetadata,

    /*
    Init metadata account (PDA) for a given mint (PDA corresponding to (x,y))
    Accounts expected:
    0. Base account
    1. metaplex metadata of space
    2. [Writable] space metadata account
    3. Mint account of space
    4. Neighborhood metadata
    5. [Signer, Writable] fee payer
    6. ATA holding space
    7. The system program
    */
    InitSpaceMetadata,

    /*
    Change sell offer
    Accounts expected:
    0. Base account
    1. [Writable] space account
    2. [Signer, Writable] owner
    3. token account
    4. sell delegate
    5. token program
    */
    ChangeOffer,

    /*
    Bob has sell offer for B, Alice takes it
    Accounts expected:
    0. Base account
    1. Neighborhood Metadata
    2. [Writable] Neighborhood creator
    3. space account
    4. B mint account
    5. [Signer] alice
    6. [Writable] alice ATA account for B
    7. bob
    8. [Writable] bob ATA account for B
    9. [Signer] sell delegate
    10. system program
    11. token program
    12. associated token program
    13. rent program
    */
    AcceptOffer,

    /*
    Initialize the voucher token system for mint 
    (
        create and initialize mint; 
        create source ATA for voucher token; 
        create sink account for voucher token; 
        mint 40k tokens to source ATA
    )
    Accounts expected:
    0. Base account
    1. Neighborhood metadata
    2. [Signer] Neighborhood creator
    3. [Signer] Voucher mint authority
    4. [Signer, Writable] voucher_mint
    5. [Signer, Writable] source ATA for voucher token
    6. [Signer, Writable] sink account for voucher token 
    7. system program
    8. token program
    9. associated token program
    10. rent program
    */
    InitVoucherSystem,

    /*
    Revoke the price exempt status for initializing new neighborhoods for creator of base
    Accounts expected:
    0. [Writable] Base account
    1. [Signer] Revoker
    */
    RevokeAuthorityPrivileges,

    /*
    Change creator
    Accounts expected:
    0. [Writable] Base account
    1. [Signer] Current creator
    2. New creator
    */
    UpdateAuthority,


    ChangeNeighborhoodName,

    /*
    obtain voucher tokens
    Accounts expected:
    0. Base account
    1. neighborhood metadata
    2. [Writable] neighborhood creator
    3. [Signer] Voucher mint authority
    4. voucher_mint
    5. [Writable] source token account of voucher tokens
    6. user wallet
    7. user voucher ATA
    8. system program
    9. token program
    10. associated token program
    11. rent program
    */
    GetVouchers,

    // TempAddxy, // elim
}

impl SpaceInstruction {
    pub fn unpack(tag: &u8) -> Result<Self, ProgramError> {
        Ok(match tag {
            0 => Self::InitBase,
            1 => Self::InitNeighborhoodMetadata,
            2 => Self::InitSpaceMetadata,
            3 => Self::ChangeOffer,
            4 => Self::AcceptOffer,
            5 => Self::InitVoucherSystem,
            6 => Self::RevokeAuthorityPrivileges,
            7 => Self::UpdateAuthority,
            8 => Self::ChangeNeighborhoodName,
            9 => Self::GetVouchers,
            // 9 => Self::TempAddxy, // elim
            _ => return Err(ProgramError::InvalidInstructionData),
        })
    }
}
