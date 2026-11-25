-- PINs that are not a place (900056, 900099, 999999 in India Post's file): they showed Kendras of another state.
DELETE FROM pin_locations WHERE pin >= '900000';
