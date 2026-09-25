-- Launch-phase change: developers can get listing without submitting CNIC
-- or a company document first. We still keep the columns (and the admin
-- review path) so document verification can be switched back on later
-- without another migration.

alter table public.developer_applications alter column cnic drop not null;
alter table public.developer_applications alter column cnic_document_path drop not null;
alter table public.developer_applications alter column company_document_path drop not null;
