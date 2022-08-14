export default /* glsl */`
#ifdef USE_MAP

	vec4 texelColor = texture2D( map, vUv );

	texelColor = mapTexelToLinear( texelColor );
	diffuseColor *= texelColor;

#endif

#ifdef USE_COARSE_MAP

	vec4 coarseTexelColor = texture2D( coarseMap, vUv2 );

	coarseTexelColor = mapTexelToLinear( coarseTexelColor );
	diffuseColor *= coarseTexelColor;

#endif
`;
