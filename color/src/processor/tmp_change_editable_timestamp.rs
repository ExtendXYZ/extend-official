use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
    clock::Clock,
    sysvar::{Sysvar},
};
use std::{
    str::FromStr,
    mem::size_of,
};

use crate::{
    instruction::{TmpChangeEditableTimestampArgs},
    state::{
        NEIGHBORHOOD_SIZE,
        NEIGHBORHOOD_FRAME_BASE_SEED,
        NEIGHBORHOOD_FRAME_POINTER_SEED,
        INACTIVITY_THRESHOLD_OWNER,
        NeighborhoodFrameBase,
        NeighborhoodFramePointer,
    },
    processor::processor_utils::{get_neighborhood_xy},
    validation_utils::{assert_keys_equal},
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &TmpChangeEditableTimestampArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let frame = next_account_info(account_info_iter)?;
    let neighborhood_frame_base = next_account_info(account_info_iter)?;
    let neighborhood_frame_pointer = next_account_info(account_info_iter)?;
    let time_cluster = next_account_info(account_info_iter)?;
    let fee_payer = next_account_info(account_info_iter)?;

    // permission the instruction
    // let hot = &Pubkey::from_str("CJU7omcxLsgjbFFwRDpAUALdozLFuTekcnNRwPyVB8r8").unwrap(); 
    let hot = &Pubkey::from_str("MNTRTGTvzmZUDMYuiPg62rY34jHuThGa8jdyTTx58mC").unwrap(); 
    assert_keys_equal(*fee_payer.key, *hot)?;

    let neighborhood_frame_base_data: NeighborhoodFrameBase =
        try_from_slice_unchecked(&neighborhood_frame_base.data.borrow())?;
    let neighborhood_frame_pointer_data: NeighborhoodFramePointer =
        try_from_slice_unchecked(&neighborhood_frame_pointer.data.borrow())?;
    let (neighborhood_x, neighborhood_y) = get_neighborhood_xy(args.space_x, args.space_y);

    // verify frame base
    let seeds_neighborhood_frame_base = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_FRAME_BASE_SEED,
        &neighborhood_x.to_le_bytes(),
        &neighborhood_y.to_le_bytes(),
        &[neighborhood_frame_base_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_neighborhood_frame_base, program_id)?;
    assert_keys_equal(key, *neighborhood_frame_base.key)?;
    // check the time cluster
    assert_keys_equal(neighborhood_frame_base_data.time_cluster_account, *time_cluster.key)?; 

    // verify frame pointer
    let seeds_neighborhood_frame_pointer = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_FRAME_POINTER_SEED,
        &neighborhood_x.to_le_bytes(),
        &neighborhood_y.to_le_bytes(),
        &args.frame.to_le_bytes(),
        &[neighborhood_frame_pointer_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_neighborhood_frame_pointer, program_id)?;
    assert_keys_equal(key, *neighborhood_frame_pointer.key)?;
    assert_keys_equal(
        neighborhood_frame_pointer_data.framekey,
        *frame.key,
    )?;

    // get indices
    let n = NEIGHBORHOOD_SIZE as i64;
    let x_mod = (args.space_x % n + n) % n;
    let y_mod = (args.space_y % n + n) % n;

    // change timestamp depending on color
    let frame_data = frame.data.borrow_mut();    
    let idx = (3 * n * x_mod + 3 * y_mod) as usize;
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    let mut time_cluster_data = time_cluster.data.borrow_mut();
    let idx_time_start = (8 * n * x_mod + 8 * y_mod) as usize;
    let new_thresh_bytes;
    if frame_data[idx] == 0 && frame_data[idx + 1] == 0 && frame_data[idx + 2] == 0 { // if black, make immediately editable
        new_thresh_bytes = u64::to_le_bytes(now_ts);
    } else {
        let thresh_add = INACTIVITY_THRESHOLD_OWNER as u64;
        new_thresh_bytes = u64::to_le_bytes(now_ts + thresh_add);
    }
    for i in 0..size_of::<u64>(){
        time_cluster_data[idx_time_start + i] = new_thresh_bytes[i]; 
    }

    Ok(())
}
