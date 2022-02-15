use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum CustomError {
    #[error("IncorrectPhase")]
    IncorrectPhase,
    #[error("UninitializedBoard")]
    UninitializedBoard,
    #[error("InvalidRegisterArgs")]
    InvalidRegisterArgs,
    #[error("PastRegistrationDeadline")]
    PastRegistrationDeadline,
    #[error("SpaceOutsideNeighborhood")]
    SpaceOutsideNeighborhood,
    #[error("PubkeyPlayer")]
    PubkeyPlayer,
    #[error("AlreadyRegistered")]
    AlreadyRegistered,
    #[error("UnregisteredSpace")]
    UnregisteredSpace,
    #[error("MissingTokenOwner")]
    MissingTokenOwner,
    #[error("PlayerMismatch")]
    PlayerMismatch,
    #[error("PlyMismatch")]
    PlyMismatch,
    #[error("IllegalMove")]
    IllegalMove,
    #[error("AccountOwnerMismatch")]
    AccountOwnerMismatch,
    #[error("PubkeyMismatch")]
    PubkeyMismatch,
    #[error("UninitializedAccount")]
    UninitializedAccount,
}

impl From<CustomError> for ProgramError {
    fn from(e: CustomError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
