text = 'in cold blood'
chrs = map(ord, text)
bins = ['{0:08b}'.format(x) for x in chrs]
print(' '.join(bins))
