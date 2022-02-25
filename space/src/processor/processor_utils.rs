use solana_program::{
    msg,
};
use std::{cmp, f64};
use crate::{
    state::{
        NEIGHBORHOOD_SIZE
    },
};

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

pub fn get_neighborhood_xy(x: i64, y: i64) -> (i64, i64){
    return (floor_divide(x, NEIGHBORHOOD_SIZE), floor_divide(y, NEIGHBORHOOD_SIZE));
}

pub fn get_space_xy_from_name(name: &str) -> (i64, i64) {
    let split = name.split('(');
    let number_str = split.last().unwrap().trim_end().trim_start();
    msg!(number_str);
    let x = number_str.split(',').collect::<Vec<&str>>()[0].trim_end().trim_start().parse::<i64>().unwrap();
    let y_withpar = number_str.split(',').collect::<Vec<&str>>()[1].trim_end().trim_start();
    let y = y_withpar.split(')').collect::<Vec<&str>>()[0].trim_end().trim_start().parse::<i64>().unwrap();

    return (x, y);
}

pub fn get_neighborhood_creation_price(n_x: i64, n_y: i64) -> u64 {
    let dist = cmp::max(n_x.abs(), n_y.abs()) as u64;

    // TODO: put constants in state
    let price = 400000+400000*cmp::max(dist-3, 0);
    
    return price;
}

pub fn get_voucher_price(exp: f64, count: u64) -> u64{
    let base = exp * (count - 1) as f64;
    let price = (base.exp() - 1.0) * 1000000000.0;
    return price.max(0.0) as u64;
}