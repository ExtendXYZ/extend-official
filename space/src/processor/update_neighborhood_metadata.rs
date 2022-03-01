use borsh::{BorshSerialize};
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    entrypoint::ProgramResult,
    borsh::try_from_slice_unchecked,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
};

use crate::{
    instruction::UpdateNeighborhoodMetadataArgs,
    state::{
        NEIGHBORHOOD_METADATA_SEED,
        NeighborhoodMetadata,
    },
    validation_utils::{assert_keys_equal},
};

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    args: &UpdateNeighborhoodMetadataArgs,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let base = next_account_info(account_info_iter)?;
    let neighborhood_metadata = next_account_info(account_info_iter)?;
    let creator = next_account_info(account_info_iter)?;

    if !creator.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }
    
    // deserialize and verify neighborhood metadata
    let mut neighborhood_metadata_data: NeighborhoodMetadata = try_from_slice_unchecked(&neighborhood_metadata.data.borrow_mut())?;

    if neighborhood_metadata_data.creator != *creator.key {
        msg!("Mismatched creator");
        return Err(ProgramError::InvalidAccountData);
    }

    let seeds_neighborhood_metadata = &[
        &base.key.to_bytes(),
        NEIGHBORHOOD_METADATA_SEED,
        &args.neighborhood_x.to_le_bytes(),
        &args.neighborhood_y.to_le_bytes(),
        &[neighborhood_metadata_data.bump],
    ];
    let key = Pubkey::create_program_address(seeds_neighborhood_metadata, program_id)?;
    assert_keys_equal(key, *neighborhood_metadata.key)?;

    // Write new info
    neighborhood_metadata_data.name = args.name;
    neighborhood_metadata_data.voucher_live_date = args.voucher_live_date;
    neighborhood_metadata_data.voucher_receive_limit = args.voucher_receive_limit;
    neighborhood_metadata_data.voucher_price_coefficient = args.voucher_price_coefficient;
    neighborhood_metadata_data.serialize(&mut *neighborhood_metadata.data.borrow_mut())?;

    Ok(())
}
