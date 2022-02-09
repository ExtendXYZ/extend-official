use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack},
    pubkey::Pubkey,
};
use legal_chess::color::Color;
use std::convert::TryInto;

use super::error::CustomError;
use crate::state::{
    NEIGHBORHOOD_SIDE,
    Side,
};

pub fn assert_keys_equal(key1: Pubkey, key2: Pubkey) -> ProgramResult {
    if key1 != key2 {
        msg!("Validation failed: keys not equal");
        Err(CustomError::PubkeyMismatch.into())
    } else {
        Ok(())
    }
}

pub fn assert_initialized<T: Pack + IsInitialized>(
    account_info: &AccountInfo,
) -> Result<T, ProgramError> {
    let account: T = T::unpack_unchecked(&account_info.data.borrow())?;
    if !account.is_initialized() {
        msg!("Validation failed: account not initialized");
        Err(CustomError::UninitializedAccount.into())
    } else {
        Ok(account)
    }
}

pub fn assert_owned_by(account: &AccountInfo, owner: &Pubkey) -> ProgramResult {
    if account.owner != owner {
        msg!("Validation failed: wrong account owner");
        Err(CustomError::AccountOwnerMismatch.into())
    } else {
        Ok(())
    }
}

pub fn floor_divide(x: i64, y: usize) -> i64 {
    if x >= 0{
        return x / y as i64;
    }
    else {
        let mut ans = x / y as i64;
        if x % y as i64 != 0{
            ans -= 1;
        }
        return ans;
    }
}

pub fn get_neighborhood_xy(x: i64, y: i64) -> (i64, i64) {
    (floor_divide(x, NEIGHBORHOOD_SIDE), floor_divide(y, NEIGHBORHOOD_SIDE))
}

pub fn get_index(sx: i64, sy: i64) -> usize {
    let (nx, ny) = get_neighborhood_xy(sx, sy);
    let snx: usize = (sx - nx * NEIGHBORHOOD_SIDE as i64).try_into().unwrap();
    let sny: usize = (sy - ny * NEIGHBORHOOD_SIDE as i64).try_into().unwrap();
    snx * NEIGHBORHOOD_SIDE + sny
}

pub fn color_to_side(c: Color) -> Side {
    match c {
        Color::WHITE => Side::White,
        Color::BLACK => Side::Black,
    }
}

pub fn side_to_color(s: Side) -> Color {
    match s {
        Side::White => Color::WHITE,
        Side::Black => Color::BLACK,
        Side::Undefined => panic!("Cannot convert undefined to legal_chess color"),
    }
}