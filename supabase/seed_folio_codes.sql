-- Folio / Parcel Control Number jurisdiction codes
-- Sources:
--   Miami-Dade: https://www.miamidadepa.gov/pa/real-estate/folio-numbers.page
--   Palm Beach: https://pbcpao.gov/muni-list.htm and https://pbcpao.gov/pcn-info.htm
--   Broward:    Broward's folio/"ID#" is Township-Range-Section based and does NOT
--               embed a municipality code the way Miami-Dade/Palm Beach do — see note row.

insert into folio_jurisdiction_codes (county, code, jurisdiction_name, notes) values
-- Miami-Dade County — first 2 digits of the 13-digit folio (99-9999-999-9999)
('Miami-Dade', '01', 'Miami', null),
('Miami-Dade', '02', 'Miami Beach', null),
('Miami-Dade', '03', 'Coral Gables', null),
('Miami-Dade', '04', 'Hialeah', null),
('Miami-Dade', '05', 'Miami Springs', null),
('Miami-Dade', '06', 'North Miami', null),
('Miami-Dade', '07', 'North Miami Beach', null),
('Miami-Dade', '08', 'Opa-locka', null),
('Miami-Dade', '09', 'South Miami', null),
('Miami-Dade', '10', 'Homestead', null),
('Miami-Dade', '11', 'Miami Shores', null),
('Miami-Dade', '12', 'Bal Harbour', null),
('Miami-Dade', '13', 'Bay Harbor Islands', null),
('Miami-Dade', '14', 'Surfside', null),
('Miami-Dade', '15', 'West Miami', null),
('Miami-Dade', '16', 'Florida City', null),
('Miami-Dade', '17', 'Biscayne Park', null),
('Miami-Dade', '18', 'El Portal', null),
('Miami-Dade', '19', 'Golden Beach', null),
('Miami-Dade', '20', 'Pinecrest', null),
('Miami-Dade', '21', 'Indian Creek', null),
('Miami-Dade', '22', 'Medley', null),
('Miami-Dade', '23', 'North Bay Village', null),
('Miami-Dade', '24', 'Key Biscayne', null),
('Miami-Dade', '25', 'Sweetwater', null),
('Miami-Dade', '26', 'Virginia Gardens', null),
('Miami-Dade', '27', 'Hialeah Gardens', null),
('Miami-Dade', '28', 'Aventura', null),
('Miami-Dade', '29', 'Islandia (former)', null),
('Miami-Dade', '30', 'Unincorporated Miami-Dade County', null),
('Miami-Dade', '31', 'Sunny Isles Beach', null),
('Miami-Dade', '32', 'Miami Lakes', null),
('Miami-Dade', '33', 'Palmetto Bay', null),
('Miami-Dade', '34', 'Miami Gardens', null),
('Miami-Dade', '35', 'Doral', null),
('Miami-Dade', '36', 'Cutler Bay', null),

-- Palm Beach County — first 2 digits of the 17-digit Parcel Control Number (PCN)
('Palm Beach', '00', 'Unincorporated Palm Beach County', null),
('Palm Beach', '02', 'Atlantis', null),
('Palm Beach', '04', 'Belle Glade', null),
('Palm Beach', '06', 'Boca Raton', null),
('Palm Beach', '08', 'Boynton Beach', null),
('Palm Beach', '09', 'Briny Breezes', null),
('Palm Beach', '10', 'Cloud Lake', null),
('Palm Beach', '12', 'Delray Beach', null),
('Palm Beach', '14', 'Glen Ridge', null),
('Palm Beach', '18', 'Greenacres', null),
('Palm Beach', '20', 'Gulf Stream', null),
('Palm Beach', '22', 'Haverhill', null),
('Palm Beach', '24', 'Highland Beach', null),
('Palm Beach', '26', 'Hypoluxo', null),
('Palm Beach', '28', 'Juno Beach', null),
('Palm Beach', '30', 'Jupiter', null),
('Palm Beach', '32', 'Jupiter Inlet Colony', null),
('Palm Beach', '34', 'Lake Clarke Shores', null),
('Palm Beach', '36', 'Lake Park', null),
('Palm Beach', '38', 'Lake Worth Beach', null),
('Palm Beach', '40', 'Lantana', null),
('Palm Beach', '41', 'Loxahatchee Groves', null),
('Palm Beach', '42', 'Manalapan', null),
('Palm Beach', '44', 'Mangonia Park', null),
('Palm Beach', '46', 'Ocean Ridge', null),
('Palm Beach', '48', 'Pahokee', null),
('Palm Beach', '50', 'Palm Beach', null),
('Palm Beach', '52', 'Palm Beach Gardens', null),
('Palm Beach', '54', 'Palm Beach Shores', null),
('Palm Beach', '56', 'Riviera Beach', null),
('Palm Beach', '58', 'South Bay', null),
('Palm Beach', '60', 'Tequesta', null),
('Palm Beach', '62', 'South Palm Beach', null),
('Palm Beach', '66', 'Village of Golf', null),
('Palm Beach', '68', 'North Palm Beach', null),
('Palm Beach', '70', 'Palm Springs', null),
('Palm Beach', '72', 'Royal Palm Beach', null),
('Palm Beach', '73', 'Wellington', null),
('Palm Beach', '74', 'West Palm Beach', null),
('Palm Beach', '77', 'Westlake', null),

-- Broward County — its folio ("ID#") is Township-Range-Section based (no
-- embedded municipality digits like Miami-Dade/Palm Beach). This placeholder
-- row documents that so the Forms Generator shows a manual jurisdiction
-- picker for Broward instead of guessing.
('Broward', 'ADDRESS_BASED', 'Broward County jobs — select jurisdiction manually (folio does not encode municipality)', 'Broward County Property Appraiser folio numbers are Township-Range-Section based and do not include a municipality code segment the way Miami-Dade and Palm Beach do. Use the job address / municipality lookup instead.')
on conflict (county, code) do nothing;
