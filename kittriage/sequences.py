"""Canonical-coordinate variants; substitutions are checked before editing."""
import hashlib
import re


def mutate(sequence, changes):
    edited = list(sequence)
    seen = set()
    for change in changes:
        match = re.fullmatch(r'([ACDEFGHIKLMNPQRSTVWY])(\d+)([ACDEFGHIKLMNPQRSTVWY])', change)
        if not match:
            raise ValueError('Unsupported substitution: ' + change)
        original, position, alternate = match.groups()
        index = int(position) - 1
        if index in seen or index < 0 or index >= len(sequence) or sequence[index] != original:
            raise ValueError('Reference residue mismatch or duplicate substitution: ' + change)
        seen.add(index)
        edited[index] = alternate
    return ''.join(edited)


def make_panel(sequence, mutations, evidence_ids):
    panel = [{'id': 'KIT_WT', 'substitutions': [], 'role': 'reference control', 'sequence': sequence}]
    # V559D is a documented exon 11 model background, not a stand-in for every exon 11 deletion.
    primary = next((m for m in mutations if m['variant'] == 'V559D' and set(m['evidence']) <= evidence_ids), None)
    if primary:
        panel.append({'id': 'KIT_V559D', 'substitutions': ['V559D'], 'role': 'exon 11 model background',
                      'sequence': mutate(sequence, ['V559D'])})
    for mutation in mutations:
        if mutation['variant'] == 'V559D' or not set(mutation['evidence']) <= evidence_ids:
            continue
        change = mutation['variant']
        panel.append({'id': 'KIT_' + change, 'substitutions': [change],
                      'role': 'isolated resistance substitution; experimental comparator',
                      'sequence': mutate(sequence, [change])})
        if primary:
            panel.append({'id': 'KIT_V559D_' + change, 'substitutions': ['V559D', change],
                          'role': 'proposed driver plus resistance construct; not every pairing is experimentally validated',
                          'sequence': mutate(sequence, ['V559D', change])})
    for row in panel:
        row['uniprot'] = 'P10721'
        row['sha256'] = hashlib.sha256(row['sequence'].encode()).hexdigest()
        row['ptarmigan_submittable'] = False
    panel[0]['ptarmigan_submittable'] = True
    return panel


def fasta(panel):
    return '\n'.join('>' + row['id'] + ' | P10721 canonical coordinates | ' + row['role'] + '\n' +
                     '\n'.join(row['sequence'][i:i+80] for i in range(0, len(row['sequence']), 80))
                     for row in panel) + '\n'
