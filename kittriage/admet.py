"""Tamarind discovery/validation plus explicit ADMET-AI output normalization."""
import csv
import math
import os
import json
from urllib.parse import urlencode

METRICS = {
    'molecular_weight': ('molecular_weight', 'Da', 'computed'),
    'logP': ('logP', 'log-ratio', 'computed'),
    'hydrogen_bond_acceptors': ('hba', 'count', 'computed'),
    'hydrogen_bond_donors': ('hbd', 'count', 'computed'),
    'Solubility_AqSolDB': ('solubility_log_molar', 'log10(mol/L)', 'prediction'),
    'hERG': ('herg_block_probability', 'probability', 'prediction'),
    'Bioavailability_Ma': ('oral_bioavailability_probability', 'probability', 'prediction'),
    'Caco2_Wang': ('caco2_permeability', 'log(cm/s)', 'prediction'),
    'PPBR_AZ': ('plasma_protein_binding', '%', 'prediction'),
    'VDss_Lombardo': ('volume_distribution', 'L/kg', 'prediction'),
    'Half_Life_Obach': ('half_life', 'hr', 'prediction'),
    'Clearance_Hepatocyte_AZ': ('hepatocyte_clearance', 'uL/min/10^6 cells', 'prediction'),
    'Clearance_Microsome_AZ': ('microsome_clearance', 'uL/min/mg', 'prediction'),
    'CYP3A4_Veith': ('cyp3a4_inhibition_probability', 'probability', 'prediction'),
    'CYP3A4_Substrate_CarbonMangels': ('cyp3a4_substrate_probability', 'probability', 'prediction'),
    'DILI': ('dili_probability', 'probability', 'prediction'),
    'PAINS_alert': ('pains_alert_count', 'count', 'computed'),
}


def split_smiles(smiles, max_settings_bytes=300000):
    """Respect the live 350 KB settings limit with a conservative payload budget."""
    base=len(json.dumps({'smilesStrings':[]}).encode('utf-8'))
    groups, current, size=[],[],base
    for molecule in smiles:
        extra=len(json.dumps(molecule).encode('utf-8'))+(2 if current else 0)
        if base+len(json.dumps(molecule).encode('utf-8'))>max_settings_bytes:
            raise ValueError('A single molecule exceeds the configured settings budget')
        if current and size+extra>max_settings_bytes:
            groups.append(current);current=[];size=base
            extra=len(json.dumps(molecule).encode('utf-8'))
        current.append(molecule);size+=extra
    if current:groups.append(current)
    return groups


class Tamarind:
    base = 'https://app.tamarind.bio/api/'

    def __init__(self, http, key=None):
        self.http = http
        self.key = key or os.environ.get('TAMARIND_API_KEY')
        if not self.key:
            raise ValueError('Set TAMARIND_API_KEY in your environment')

    def call(self, route, body=None):
        return self.http.json(self.base + route, body, {'x-api-key': self.key}, cache=False,allow_text=True)

    def admet_payload(self, smiles, job_name):
        if not smiles or any(not isinstance(s,str) or not s.strip() for s in smiles):
            raise ValueError('Nonempty SMILES inputs required')
        tools = self.call('tools')
        tool = next((t for t in tools if t['name'] == 'admet'), None)
        if not tool or not any(s['name'] == 'smilesStrings' for s in tool['settings']):
            raise ValueError('ADMET tool contract unavailable in this account')
        import re
        if not re.fullmatch(r'[A-Za-z0-9_.-]{1,200}', job_name):
            raise ValueError('Use a clean, unique job name of at most 200 characters')
        return {'jobName': job_name, 'type': tool['name'], 'settings': {'smilesStrings': smiles}}

    def validate(self, payload):
        result=self.call('validate-job', payload)
        if isinstance(result,dict) and (result.get('valid') is False or result.get('error') or result.get('errors') or result.get('missing_fields')):
            raise ValueError('Tamarind validation failed; inspect the validation result before submitting')
        return result

    def submit(self, payload):
        # Calling submit is explicit; no retry or account provisioning is performed.
        self.validate(payload)
        return self.call('submit-job', payload)

    def status(self, job_name):
        return self.call('jobs?' + urlencode({'jobName': job_name}))

    def result_link(self, job_name):
        return self.call('result', {'jobName': job_name})


def import_admet(csv_path, compounds_by_smiles, source):
    """SMILES-keyed join only. Never assume remote CSV row order matches input order."""
    results, unmatched, seen = [], [], set()
    with open(csv_path, newline='', encoding='utf-8-sig') as handle:
        for row in csv.DictReader(handle):
            smiles = row.get('smiles')
            if smiles not in compounds_by_smiles:
                unmatched.append(smiles)
                continue
            if smiles in seen:
                raise ValueError('Duplicate ADMET SMILES result; resolve before importing')
            seen.add(smiles)
            compound = dict(compounds_by_smiles[smiles])
            measurements = dict(compound.get('measurements', {}))
            for column, (metric, units, kind) in METRICS.items():
                if row.get(column) in (None, ''):
                    continue
                try:
                    value = float(row[column])
                except ValueError:
                    continue
                if not math.isfinite(value) or (units == 'probability' and not 0 <= value <= 1):
                    continue
                measurements[metric] = {'value': value, 'units': units, 'kind': kind, 'source': source,
                                        'context': {'model': 'ADMET-AI', 'output_column': column}}
            compound['measurements'] = measurements
            add_composite_flags(compound)
            results.append(compound)
    return {'compounds': results, 'unmatched_smiles': unmatched,
            'missing_input_ids': [c['id'] for s,c in compounds_by_smiles.items() if s not in seen]}


def add_composite_flags(compound):
    m=compound.setdefault('measurements',{})
    if 'molecular_weight' in m and 'logP' in m:
        m['coupled_developability_risk']={
            'value':int(m['molecular_weight']['value']>400 and m['logP']['value']>4),
            'units':'count','kind':'computed','source':m['logP']['source'],
            'context':{'definition':'MW >400 Da AND computed logP >4; heuristic region flag, not a ban'}}
    if compound.get('ptarmigan'):
        m['wt_engagement']={'value':compound['ptarmigan']['engagement'],'units':'probability',
          'kind':'prediction','source':'Ptarmigan catalog KIT screen',
          'context':{'target':'KIT reference protein','model_version':compound['ptarmigan'].get('model_version','see screen metadata')}}
