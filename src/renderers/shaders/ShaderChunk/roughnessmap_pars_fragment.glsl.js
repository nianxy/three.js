export default /* glsl */`
#ifdef USE_ROUGHNESSMAP

	uniform sampler2D roughnessMap;

#endif

#ifdef USE_COARSE_ROUGHNESSMAP

	uniform sampler2D coarseRoughnessMap;

#endif
`;
