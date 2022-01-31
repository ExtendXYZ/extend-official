use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    clock::Clock,
    sysvar::{Sysvar},
};
use std::{
    str::FromStr,
    mem::size_of,
    convert::TryInto,
};

use crate::{
    error::CustomError,
    instruction::{MakeEditableArgs, MakeEditableBriefArgs},
    state::{
        NEIGHBORHOOD_SIZE,
        SPACE_PID,
        SPACE_METADATA_SEED,
        SpaceMetadata,
    },
    validation_utils::{assert_is_ata, assert_keys_equal},
};

pub fn process(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &MakeEditableArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let space_metadata = next_account_info(account_info_iter)?;
    let owner = next_account_info(account_info_iter)?;
    let space_ata = next_account_info(account_info_iter)?;
    let time_cluster = next_account_info(account_info_iter)?;

    // check fee payer is signer
    if !owner.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    //  deserialize and check all PDAs
    let space_metadata_data: SpaceMetadata =
        try_from_slice_unchecked(&space_metadata.data.borrow())?;

    // verify space metadata
    let seeds_space_metadata = &[
        &base.key.to_bytes(),
        SPACE_METADATA_SEED,
        &args.space_x.to_le_bytes(),
        &args.space_y.to_le_bytes(),
        &[space_metadata_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_space_metadata, &Pubkey::from_str(SPACE_PID).unwrap())?;
    assert_keys_equal(key, *space_metadata.key)?;

    // check ATAs
    assert_is_ata(space_ata, owner.key, &space_metadata_data.mint)?;

    // verify token is owned
    let space_ata_data = spl_token::state::Account::unpack_from_slice(&space_ata.data.borrow())?;
    if space_ata_data.amount != 1 {
        msg!("Error: token account does not own token");
        return Err(CustomError::MissingTokenOwner.into());
    }

    // get indices
    let n = NEIGHBORHOOD_SIZE as i64;
    let x_mod = (args.space_x % n + n) % n;
    let y_mod = (args.space_y % n + n) % n;

    // inactivity checks for non-owner fee payer
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    let mut time_cluster_data = time_cluster.data.borrow_mut();
    let idx_time_start = (8 * n * x_mod + 8 * y_mod) as usize;
    let idx_time_end = idx_time_start + 8;
    let time_thresh = u64::from_le_bytes( time_cluster_data[idx_time_start..idx_time_end].try_into().expect("incorrect") );
    if time_thresh < now_ts {
        msg!("Cannot make space editable while already inactive/editable");
        return Err(ProgramError::InvalidArgument);
    }

    let new_thresh_bytes = u64::to_le_bytes(now_ts);
    for i in 0..size_of::<u64>(){
        time_cluster_data[idx_time_start + i] = new_thresh_bytes[i]; 
    }

    Ok(())
}

pub fn process_brief(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args_brief: &MakeEditableBriefArgs,
) -> ProgramResult {

    let args = MakeEditableArgs{
        space_x: args_brief.space_x as i64,
        space_y: args_brief.space_y as i64,
    };
    process(program_id, accounts, &args)?;
    Ok(())
}


