use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum CustomError {
    #[error("WrongAuthority")]
    WrongAuthority,
    #[error("UnterminatedRent")]
    UnterminatedRent,
    #[error("MissingTokenOwner")]
    MissingTokenOwner,
    #[error("AccountFrozen")]
    AccountFrozen,
    #[error("MissingFreezeAuth")]
    MissingFreezeAuth,
    #[error("WrongAuthToFreeze")]
    WrongAuthToFreeze,
    #[error("WrongColorAccountPDA")]
    WrongColorAccountPDA,
    #[error("WrongMetadataAccountPDA")]
    WrongMetadataAccountPDA,
    #[error("OwnerAccountMismatch")]
    OwnerAccountMismatch,
    #[error("PublicKeyMismatch")]
    PublicKeyMismatch,
    #[error("UninitializedAccount")]
    UninitializedAccount,
    #[error("IncorrectOwner")]
    IncorrectOwner,
    #[error("MintMismatch")]
    MintMismatch,
    #[error("NotSwappable")]
    NotSwappable,
    #[error("InvalidListing")]
    InvalidListing,
    #[error("ColorClusterAlreadyInitialized")]
    ColorClusterAlreadyInitialized,
}

impl From<CustomError> for ProgramError {
    fn from(e: CustomError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
