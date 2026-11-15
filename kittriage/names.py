"""NCATS exact-name resolution and public compound descriptors."""
from urllib.parse import quote, urlencode


def ncats_lookup(http, name):
    response = http.json('https://drugs.ncats.io/api/v1/substances/search?' +
                         urlencode({'q': 'root_names_name:"^' + name.upper() + '$"', 'top': 10}))
    records = []
    for row in response.get('content', []):
        records.append({'uuid': row.get('uuid'), 'unii': row.get('approvalID'),
                        'name': row.get('_name', row.get('name')),
                        'names': [n['name'] for n in row.get('names', []) if n.get('name')],
                        'smiles': row.get('structure', {}).get('smiles')})
    return {'query':name,'status':'resolved' if len(records)==1 else ('ambiguous' if records else 'not_found'),
            'records':records,'source':'NCATS Inxight Drugs',
            'note':'Salt and parent substances remain distinct records; ambiguous matches require review.'}


def pubchem_compound(http, name):
    url = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + quote(name, safe='') + '/property/MolecularWeight,XLogP,HBondDonorCount,HBondAcceptorCount,CanonicalSMILES,InChIKey/JSON'
    data = http.json(url)['PropertyTable']['Properties']
    if len(data) != 1:
        raise ValueError('Ambiguous PubChem name: ' + name)
    row=data[0]
    source = 'https://pubchem.ncbi.nlm.nih.gov/compound/' + str(row['CID'])
    measurements={}
    for column, metric, units in [('MolecularWeight','molecular_weight','Da'),('XLogP','logP','log-ratio'),
                                   ('HBondDonorCount','hbd','count'),('HBondAcceptorCount','hba','count')]:
        if column in row:
            measurements[metric]={'value':float(row[column]),'units':units,'kind':'computed','source':source}
    return {'id':'CID'+str(row['CID']),'name':name,'pubchem_cid':row['CID'],
            'smiles':row.get('ConnectivitySMILES',row.get('CanonicalSMILES')),
            'inchikey':row.get('InChIKey'),'measurements':measurements,'role':'reference control', 'source':source}
