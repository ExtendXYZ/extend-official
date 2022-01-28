use borsh::{BorshSerialize};
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    entrypoint::ProgramResult,
    borsh::try_from_slice_unchecked,
    msg,
    program::invoke_signed,
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    clock::Clock,
    sysvar::{Sysvar, rent::Rent},
    system_instruction,
    system_program,
};
use std::{str::FromStr};

use spl_token;

use crate::{
    error::CustomError,
    instruction::SetRentArgs,
    state::{
        SPACE_METADATA_SEED,
        RENT_ACCOUNT_SEED,
        RENT_ACCOUNT_RESERVE,
        RentAccount,
        SpaceMetadata,
        SPACE_PID,
    },
    validation_utils::{assert_is_ata, assert_keys_equal},
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &SetRentArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let space_metadata = next_account_info(account_info_iter)?;
    let rent_account = next_account_info(account_info_iter)?;
    let lessor = next_account_info(account_info_iter)?;
    let ata_space = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    if !lessor.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
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
    // create rent account if not already existing
    let seeds_rent_account = &[
        &base.key.to_bytes(),
        RENT_ACCOUNT_SEED,
        &args.space_x.to_le_bytes(),
        &args.space_y.to_le_bytes(),
    ];
    let (key, rent_account_bump) = Pubkey::find_program_address(seeds_rent_account, program_id);
    assert_keys_equal(key, *rent_account.key)?;
    let seeds_rent_account = &[
        &base.key.to_bytes(),
        RENT_ACCOUNT_SEED,
        &args.space_x.to_le_bytes(),
        &args.space_y.to_le_bytes(),
        &[rent_account_bump],
    ];
    let mut rent_account_data: RentAccount;
    if rent_account.data_len() == 0 {
        let required_lamports = Rent::default()
            .minimum_balance(RENT_ACCOUNT_RESERVE)
            .max(1)
            .saturating_sub(rent_account.lamports());
        invoke_signed(
            &system_instruction::create_account(
                lessor.key,
                rent_account.key,
                required_lamports,
                RENT_ACCOUNT_RESERVE as u64,
                program_id,
            ),
            &[
                lessor.clone(),
                rent_account.clone(),
                system_program.clone(),
            ],
            &[seeds_rent_account],
        )?;

        rent_account_data = try_from_slice_unchecked(&rent_account.data.borrow_mut())?;
        rent_account_data.bump = rent_account_bump;
        rent_account_data.mint = space_metadata_data.mint;
    }
    else {
        rent_account_data = try_from_slice_unchecked(&rent_account.data.borrow_mut())?;
    }
    
    // ensure min duration, max timestamp are valid
    let now_ts = Clock::get().unwrap().unix_timestamp as u64;
    if args.create && now_ts + args.min_duration > args.max_timestamp {
        msg!("Less time until maximum rent end than the specified minimum rent duration");
        return Err(ProgramError::InvalidInstructionData);
    }


    // main code
    // list
    if args.create {
        rent_account_data.price = args.price;
        rent_account_data.min_duration = args.min_duration;
        rent_account_data.max_duration = args.max_duration;
        rent_account_data.max_timestamp = args.max_timestamp;
        rent_account_data.lister = *lessor.key;
    }
    // delist
    else 
    {
        rent_account_data.price = 0;
        rent_account_data.min_duration = 0;
        rent_account_data.max_duration = 0;
        rent_account_data.max_timestamp = 0;
    }

    rent_account_data.serialize(&mut *rent_account.data.borrow_mut())?;
    
    msg!("done");
    Ok(())
}
