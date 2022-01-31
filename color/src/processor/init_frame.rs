use borsh::BorshSerialize;
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    borsh::try_from_slice_unchecked,
    entrypoint::ProgramResult,
    msg,
    program::{invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction, system_program,
    sysvar::rent::Rent,
};
use std::mem::size_of;
use std::str::FromStr;

use crate::{
    instruction::InitFrameArgs,
    state::{
        SPACE_PID,
        NEIGHBORHOOD_SIZE,
        NEIGHBORHOOD_METADATA_SEED,
        NEIGHBORHOOD_FRAME_BASE_SEED,
        NEIGHBORHOOD_FRAME_BASE_RESERVE,
        NEIGHBORHOOD_FRAME_POINTER_SEED,
        NEIGHBORHOOD_FRAME_POINTER_RESERVE,
        NeighborhoodMetadata,
        NeighborhoodFrameBase,
        NeighborhoodFramePointer,
        MAX_FRAMES,
    },
    validation_utils::assert_keys_equal,
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &InitFrameArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let color_frame_cluster = next_account_info(account_info_iter)?;
    let neighborhood_frame_base = next_account_info(account_info_iter)?;
    let neighborhood_frame_pointer = next_account_info(account_info_iter)?;
    let neighborhood_metadata = next_account_info(account_info_iter)?;
    let fee_payer = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let time_cluster = next_account_info(account_info_iter)?;

    // check signers
    if !fee_payer.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // check programs
    assert_keys_equal(system_program::id(), *system_program.key)?;

    // check PDA of neighborhood frame base account and create it if necessary
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
    if neighborhood_frame_base.data_len() == 0{
        // create NeighborhoodFrameBase account
        let required_lamports = Rent::default()
            .minimum_balance(NEIGHBORHOOD_FRAME_BASE_RESERVE)
            .max(1)
            .saturating_sub(neighborhood_frame_base.lamports());
        invoke_signed(
            &system_instruction::create_account(
                fee_payer.key,
                neighborhood_frame_base.key,
                required_lamports,
                NEIGHBORHOOD_FRAME_BASE_RESERVE as u64,
                program_id,
            ),
            &[
                fee_payer.clone(),
                neighborhood_frame_base.clone(),
                system_program.clone(),
            ],
            &[seeds_neighborhood_frame_base],
        )?;
        // write bump seed
        neighborhood_frame_base_data = try_from_slice_unchecked(&neighborhood_frame_base.data.borrow_mut())?;
        neighborhood_frame_base_data.bump = neighborhood_frame_base_bump;
        neighborhood_frame_base_data.length = 0;

        
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

    }
    else{
        neighborhood_frame_base_data = try_from_slice_unchecked(&neighborhood_frame_base.data.borrow_mut())?;
    }
    if neighborhood_frame_base_data.length >= MAX_FRAMES {
        msg!("Already have the maximum number of frames");
        return Err(ProgramError::InvalidInstructionData);
    }

    // verify and create neighborhood frame pointer
    let seeds_neighborhood_frame_pointer = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_FRAME_POINTER_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
        &neighborhood_frame_base_data.length.to_le_bytes(),
    ];
    let (key, neighborhood_frame_pointer_bump) = Pubkey::find_program_address(seeds_neighborhood_frame_pointer, program_id);
    assert_keys_equal(key, *neighborhood_frame_pointer.key)?;
    let seeds_neighborhood_frame_pointer = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_FRAME_POINTER_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
        &neighborhood_frame_base_data.length.to_le_bytes(),
        &[neighborhood_frame_pointer_bump],
    ];

    let required_lamports = Rent::default()
        .minimum_balance(NEIGHBORHOOD_FRAME_POINTER_RESERVE)
        .max(1)
        .saturating_sub(neighborhood_frame_pointer.lamports());
    invoke_signed(
        &system_instruction::create_account(
            fee_payer.key,
            neighborhood_frame_pointer.key,
            required_lamports,
            NEIGHBORHOOD_FRAME_POINTER_RESERVE as u64,
            program_id,
        ),
        &[
            fee_payer.clone(),
            neighborhood_frame_pointer.clone(),
            system_program.clone(),
        ],
        &[seeds_neighborhood_frame_pointer],
    )?;
    let mut neighborhood_frame_pointer_data: NeighborhoodFramePointer = try_from_slice_unchecked(&neighborhood_frame_pointer.data.borrow_mut())?;

    //deserialize and verify neighborhood metadata
    let neighborhood_metadata_data: NeighborhoodMetadata = try_from_slice_unchecked(&neighborhood_metadata.data.borrow_mut())?;
    let seeds_neighborhood_metadata = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_METADATA_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
        &[neighborhood_metadata_data.bump],
    ];
    let key =
        Pubkey::create_program_address(seeds_neighborhood_metadata, &Pubkey::from_str(SPACE_PID).unwrap())?;
    assert_keys_equal(key, *neighborhood_metadata.key)?;

    // write frame pointer
    neighborhood_frame_pointer_data.bump = neighborhood_frame_pointer_bump;
    neighborhood_frame_pointer_data.framekey = *color_frame_cluster.key;
    neighborhood_frame_pointer_data.serialize(&mut *neighborhood_frame_pointer.data.borrow_mut())?;

    // update frame base
    neighborhood_frame_base_data.length += 1;
    neighborhood_frame_base_data.time_cluster_account = *time_cluster.key;
    neighborhood_frame_base_data.serialize(&mut *neighborhood_frame_base.data.borrow_mut())?;

    // zero out data in color cluster
    let mut color_frame_cluster_data = color_frame_cluster.data.borrow_mut();
    for val in color_frame_cluster_data.iter_mut() {
        *val = 0;
    }

    // write other data into color cluster account
    let buffer_x = args.neighborhood_x.try_to_vec().unwrap();
    let buffer_y = args.neighborhood_y.try_to_vec().unwrap();
    let start_x = 3 * NEIGHBORHOOD_SIZE * NEIGHBORHOOD_SIZE;
    let start_y = start_x + size_of::<i64>();
    let start_initialized = start_y + size_of::<i64>();
    if color_frame_cluster_data[start_initialized] != 0 {
        return Err(ProgramError::InvalidAccountData);
    }
    for i in 0..size_of::<i64>(){
        color_frame_cluster_data[start_x + i] = buffer_x[i]; 
    }
    for i in 0..size_of::<i64>(){
        color_frame_cluster_data[start_y + i] = buffer_y[i]; 
    }
    color_frame_cluster_data[start_initialized] = 1;

    Ok(())
}
