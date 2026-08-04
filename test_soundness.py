import sys
sys.path.insert(0, '/Users/HannahTersbol/Desktop/Bachelor/ada/src')
sys.path.insert(0, '.')
from BackEnd.adaAPI import check_pnml_soundness

pnml_files = [
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/auction_simple_thresh.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/package_handling.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/dig_whiteboard_registration.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/auction.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/auction_simple_reset.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/dig_whiteboard_transfer.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/road_fines_mined2.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/road_fines_normative.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/sepsis_normative.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/credit_approval.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/dig_whiteboard_discharge.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/road_fines_mined.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/auction_simple.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/sepsis_mined.pnml',
    '/Users/HannahTersbol/Desktop/Bachelor/ada/examples/dpns/hospital_billing.pnml',
]

print("Soundness Check Results for ADA Examples:")
print("=" * 80)

sound_files = []
unsound_files = []

for pnml_file in pnml_files:
    filename = pnml_file.split('/')[-1]
    try:
        is_sound = check_pnml_soundness(pnml_file)
        status = "✓ SOUND" if is_sound else "✗ UNSOUND"
        if is_sound:
            sound_files.append(filename)
        else:
            unsound_files.append(filename)
        print(f"{status:12} | {filename}")
    except Exception as e:
        print(f"ERROR        | {filename}")

print("\n" + "=" * 80)
print(f"Sound files: {len(sound_files)}")
for f in sound_files:
    print(f"  ✓ {f}")
print(f"\nUnsound files: {len(unsound_files)}")
