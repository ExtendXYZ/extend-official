use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey,
};
use std::mem::size_of;

use crate::{
    instruction::TEMPMakeTimeClusterArgs,
    state::{
        NEIGHBORHOOD_SIZE,
        NEIGHBORHOOD_FRAME_BASE_SEED,
        NeighborhoodFrameBase,
    },
    validation_utils::assert_keys_equal,
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &TEMPMakeTimeClusterArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let neighborhood_frame_base = next_account_info(account_info_iter)?;
    let fee_payer = next_account_info(account_info_iter)?;
    let time_cluster = next_account_info(account_info_iter)?;

    // check signers
    if !fee_payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // check PDA of neighborhood frame base account
    let seeds_neighborhood_frame_base = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_FRAME_BASE_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
    ];
    let (key, neighborhood_frame_base_bump) = Pubkey::find_program_address(seeds_neighborhood_frame_base, program_id);
    assert_keys_equal(key, *neighborhood_frame_base.key)?;
    let seeds_neighborhood_frame_base = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_FRAME_BASE_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
        &[neighborhood_frame_base_bump],
    ];
    let mut neighborhood_frame_base_data: NeighborhoodFrameBase;
    
    // write bump seed
    neighborhood_frame_base_data = try_from_slice_unchecked(&neighborhood_frame_base.data.borrow_mut())?;

    // zero out data in time cluster
    let mut time_cluster_data = time_cluster.data.borrow_mut();
    for val in time_cluster_data.iter_mut() {
        *val = 0;
    }
    // write other data into time cluster account
    let buffer_x = args.neighborhood_x.try_to_vec().unwrap();
    let buffer_y = args.neighborhood_y.try_to_vec().unwrap();
    let start_x = size_of::<u64>() * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE;
    let start_y = start_x + size_of::<i64>();
    let start_initialized = start_y + size_of::<i64>();
    if time_cluster_data[start_initialized] != 0 {
        return Err(ProgramError::InvalidAccountData);
    }
    for i in 0..size_of::<i64>(){
        time_cluster_data[start_x + i] = buffer_x[i]; 
    }
    for i in 0..size_of::<i64>(){
        time_cluster_data[start_y + i] = buffer_y[i]; 
    }
    time_cluster_data[start_initialized] = 1;

    neighborhood_frame_base_data.time_cluster_account = *time_cluster.key;
    neighborhood_frame_base_data.serialize(&mut *neighborhood_frame_base.data.borrow_mut())?;

    Ok(())
}
