use borsh::{BorshSerialize};
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    entrypoint::ProgramResult,
    borsh::try_from_slice_unchecked,
    msg,
    program::invoke,
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    clock::Clock,
    sysvar::{Sysvar},
    system_instruction,
    system_program,
};
use std::{str::FromStr, cmp::min};

use spl_token;

use crate::{
    error::CustomError,
    instruction::AcceptRentArgs,
    state::{
        SPACE_METADATA_SEED,
        RENT_ACCOUNT_SEED,
        RentAccount,
        SpaceMetadata,
        SPACE_PID,
    },
    validation_utils::{assert_is_ata, assert_keys_equal},
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &AcceptRentArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let space_metadata = next_account_info(account_info_iter)?;
    let rent_account = next_account_info(account_info_iter)?;
    let lessee = next_account_info(account_info_iter)?;
    let lessor = next_account_info(account_info_iter)?;
    let ata_space = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !lessee.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // check lessee != lessor
    if *lessee.key == *lessor.key {
        msg!("Provided lessee and lessor are the same wallets");
        return Err(ProgramError::InvalidAccountData);
    }


    // check programs
    assert_keys_equal(system_program::id(), *system_program.key)?;


    //deserialize and verify space metadata
    let space_metadata_data: SpaceMetadata = try_from_slice_unchecked(&space_metadata.data.borrow_mut())?;

    let seeds_space_metadata = &[
        &base.key.to_bytes(),
        SPACE_METADATA_SEED,
        &args.space_x.to_le_bytes(),
        &args.space_y.to_le_bytes(),
        &[space_metadata_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_space_metadata, &Pubkey::from_str(SPACE_PID).unwrap())?;
    assert_keys_equal(key, *space_metadata.key)?;


    //check ATAs
    assert_is_ata(ata_space, lessor.key, &space_metadata_data.mint)?;

    // check NFT owned
    let ata_data = spl_token::state::Account::unpack_from_slice(&ata_space.data.borrow())?;
    if ata_data.amount != 1 {
        msg!("Error: token account does not own token");
        return Err(CustomError::MissingTokenOwner.into());
    }


    // deserialize and verify rent account
    let mut rent_account_data: RentAccount = try_from_slice_unchecked(&rent_account.data.borrow_mut())?;
    let seeds_rent_account = &[
        &base.key.to_bytes(),
        RENT_ACCOUNT_SEED,
        &args.space_x.to_le_bytes(),
        &args.space_y.to_le_bytes(),
        &[rent_account_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_rent_account, program_id)?;
    assert_keys_equal(key, *rent_account.key)?;
    
    // ensure not already rented
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    if rent_account_data.rent_end > now_ts {
        msg!("Space currently rented out");
        return Err(ProgramError::InvalidInstructionData);
    }
    
    // ensure rentable
    // ensure rent lister matches lessor
    assert_keys_equal(rent_account_data.lister, *lessor.key)?;

    // ensure rent period valid
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    let putative_rent_end = now_ts + args.rent_time;
    
    let exceeds_max_timestamp = rent_account_data.max_timestamp < putative_rent_end;
    let below_min_duration = rent_account_data.min_duration > args.rent_time;
    let above_max_duration = rent_account_data.max_duration < args.rent_time;

    if !exceeds_max_timestamp && below_min_duration {
        msg!("Specified rent period less than listing minimum rent duration");
        return Err(ProgramError::InvalidInstructionData);
    }

    if above_max_duration {
        msg!("Specified rent period greater than listing maximum rent duration");
        return Err(ProgramError::InvalidInstructionData);
    }

    // ensure price valid
    if rent_account_data.price != args.price {
        msg!("Specified price does not match listing price");
        return Err(ProgramError::InvalidInstructionData);
    }


    // main code
    let actual_rent_time = min(args.rent_time, rent_account_data.max_timestamp-now_ts);
    // invoke SOL transfer
    invoke(
        &system_instruction::transfer(
            lessee.key,
            lessor.key,
            args.price * (actual_rent_time),
        ),
        &[
            lessee.clone(),
            lessor.clone(),
            system_program.clone(),
        ],
    )?;

    // update rent account data
    rent_account_data.rent_end = now_ts + actual_rent_time;
    rent_account_data.lessee = *lessee.key;

    rent_account_data.serialize(&mut *rent_account.data.borrow_mut())?;
    
    msg!("done");
    Ok(())
}