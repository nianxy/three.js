export default /* glsl */`
#ifdef USE_MAP

	uniform sampler2D map;

#endif

#ifdef USE_COARSE_MAP

	uniform sampler2D coarseMap;

#endif
`;
