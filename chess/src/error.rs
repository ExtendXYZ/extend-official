use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum CustomError {
    #[error("AccountPermissions")]
    AccountPermissions,
    #[error("IncorrectPhase")]
    IncorrectPhase,
    #[error("InvalidInitBoardArgs")]
    InvalidInitBoardArgs,
    #[error("InvalidRegisterArgs")]
    InvalidRegisterArgs,
    #[error("InvalidVoteArgs")]
    InvalidVoteArgs,
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
